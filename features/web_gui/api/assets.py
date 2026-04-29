"""Assets routes — upload, list, delete user-uploaded creative assets.

All routes require an existing project slug (resolve_ads_path raises 404 if
not). User uploads land under uploads_dir()/<slug>/. Built-in brand assets
(brand/logos, brand/social/renders, etc) are NOT exposed by this router —
they are served read-only by the /brand StaticFiles mount.

Routes:
  POST   /api/v1/assets/upload
  GET    /api/v1/projects/{slug}/assets
  DELETE /api/v1/projects/{slug}/assets/{file_id}
"""
from __future__ import annotations

import re
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Response

from features.web_gui.api._helpers import resolve_ads_path
from features.web_gui.services import asset_store

router = APIRouter(tags=["assets"])

# Same shape as asset_store._FILE_ID_RE; the route enforces it before the
# store call so 400s look distinct from 404s in the API.
_FILE_ID_RE = re.compile(r"^[0-9a-f]{32}$")

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


@router.get("/projects/{slug}/assets")
async def list_assets(slug: str) -> dict:
    """List every user-uploaded asset for a project.

    Returns 404 when the project does not exist (path-traversal guard via
    resolve_ads_path). Built-in brand assets are not included — those are
    served by the /brand StaticFiles mount.
    """
    resolve_ads_path(slug)
    items = asset_store.list_(slug)
    # Strip the on-disk path before returning — clients shouldn't see
    # server-local filesystem layout.
    return {
        "assets": [
            {k: v for k, v in it.items() if k != "path"}
            for it in items
        ],
    }


@router.delete("/projects/{slug}/assets/{file_id}", status_code=204)
async def delete_asset(slug: str, file_id: str) -> Response:
    """Delete a user-uploaded asset by file_id.

    Returns 204 on success, 400 for malformed file_id, 404 for unknown
    project or unknown file_id (within an existing project).
    """
    resolve_ads_path(slug)
    if not _FILE_ID_RE.match(file_id):
        raise HTTPException(
            status_code=400,
            detail={
                "error": f"file_id {file_id!r} is not a valid 32-char hex id",
                "code": "INVALID_FILE_ID",
            },
        )
    if not asset_store.delete(slug, file_id):
        raise HTTPException(
            status_code=404,
            detail={
                "error": f"asset {file_id!r} not found in project {slug!r}",
                "code": "ASSET_NOT_FOUND",
            },
        )
    return Response(status_code=204)
