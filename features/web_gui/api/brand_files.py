"""Brand file management — DELETE /api/v1/brand-files.

Allows the UI to remove canonical brand assets (logos, social renders,
favicons) from disk via a hardened path-validation pipeline.

Security model:
  - Paths are relative under brand_dir() — never absolute.
  - `..` segments are rejected before resolution (defense in depth).
  - After resolution, the resolved path must still live under brand_dir()
    (catches symlink escape).
  - A small allowlist of files cannot be deleted (tokens.css and the
    guidelines pair) since they're brand SPEC, not assets.

Routes:
  DELETE /api/v1/brand-files   {"path": "logos/vibeweb-icon.svg"}
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, HTTPException

from features.web_gui.settings import brand_dir

router = APIRouter(tags=["brand-files"])

# Files we will never delete via the API — they encode the brand SPEC, not
# replaceable assets. Match by relative-to-brand path.
_PROTECTED: frozenset[str] = frozenset({
    "tokens.css",
    "guidelines.html",
    "guidelines.css",
})


@router.delete("/brand-files", status_code=204)
async def delete_brand_file(payload: dict[str, Any] = Body(default={})):
    raw_path = payload.get("path") if isinstance(payload, dict) else None
    if not isinstance(raw_path, str) or not raw_path.strip():
        raise HTTPException(
            status_code=400,
            detail={"error": "missing or empty 'path' in body", "code": "INVALID_PATH"},
        )
    rel = raw_path.strip()

    # Reject obvious traversal + absolute paths BEFORE filesystem touches.
    if rel.startswith("/") or rel.startswith("\\") or ".." in rel.replace("\\", "/").split("/"):
        raise HTTPException(
            status_code=400,
            detail={"error": f"path {rel!r} contains traversal or is absolute", "code": "INVALID_PATH"},
        )

    # Normalise + check protected set BEFORE touching filesystem.
    normalised = rel.replace("\\", "/").lstrip("./")
    if normalised in _PROTECTED:
        raise HTTPException(
            status_code=403,
            detail={"error": f"path {rel!r} is part of the brand spec and cannot be deleted", "code": "PROTECTED_PATH"},
        )

    bdir = brand_dir().resolve()
    candidate = (bdir / rel).resolve()

    # Symlink-escape guard: resolved path must stay inside brand_dir.
    try:
        candidate.relative_to(bdir)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={"error": f"path {rel!r} escapes brand directory after resolution", "code": "INVALID_PATH"},
        )

    if not candidate.exists():
        raise HTTPException(
            status_code=404,
            detail={"error": f"file {rel!r} not found under brand/", "code": "NOT_FOUND"},
        )
    if not candidate.is_file():
        raise HTTPException(
            status_code=400,
            detail={"error": f"path {rel!r} is not a regular file", "code": "INVALID_PATH"},
        )

    candidate.unlink()
    return None
