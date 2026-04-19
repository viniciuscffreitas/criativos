"""Assets upload route — POST /api/v1/assets/upload.

Accepts multipart file uploads for a known project slug.
Guards: project existence, MIME type allowlist, 10 MB size cap, filename
path-traversal stripping.

Routes:
  POST /api/v1/assets/upload
"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from features.web_gui.api._helpers import resolve_ads_path
from features.web_gui.services import asset_store
from features.web_gui.settings import uploads_dir

router = APIRouter(tags=["assets"])

_MAX_BYTES = 10 * 1024 * 1024  # 10 MB

_ALLOWED_MIME: frozenset[str] = frozenset({
    "image/png",
    "image/jpeg",
    "image/svg+xml",
    "application/pdf",
    "video/mp4",
})


@router.post("/assets/upload")
async def upload_assets(
    project_slug: str = Form(...),
    files: list[UploadFile] = File(...),
):
    # Validate project exists (also guards path traversal on slug).
    resolve_ads_path(project_slug)

    uploaded = []
    for f in files:
        content_type = (f.content_type or "").split(";")[0].strip()
        if content_type not in _ALLOWED_MIME:
            raise HTTPException(
                status_code=415,
                detail={
                    "error": (
                        f"file {f.filename!r} has unsupported content type {content_type!r}; "
                        f"allowed: {sorted(_ALLOWED_MIME)}"
                    ),
                    "code": "UNSUPPORTED_MEDIA_TYPE",
                },
            )

        content = await f.read()
        if len(content) > _MAX_BYTES:
            raise HTTPException(
                status_code=413,
                detail={
                    "error": (
                        f"file {f.filename!r} exceeds 10 MB limit "
                        f"({len(content)} bytes)"
                    ),
                    "code": "FILE_TOO_LARGE",
                },
            )

        # Strip path components from filename (defense in depth; asset_store does it too).
        safe_name = Path(f.filename or "").name
        if not safe_name:
            raise HTTPException(
                status_code=400,
                detail={"error": "filename is empty or invalid", "code": "INVALID_FILENAME"},
            )

        try:
            metadata = asset_store.save(project_slug, safe_name, content)
        except ValueError as exc:
            raise HTTPException(
                status_code=415,
                detail={"error": str(exc), "code": "UNSUPPORTED_MEDIA_TYPE"},
            ) from exc

        uploaded.append({
            "file_id": metadata["file_id"],
            "filename": metadata["filename"],
            "size": metadata["size"],
            "kind": metadata["kind"],
        })

    return {"uploaded": uploaded}
