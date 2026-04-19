"""Persist uploaded creative assets to disk.

Each saved file gets a uuid4 hex file_id; the original filename is sanitised
(Path.name strips any directory components). Caller is responsible for ensuring
the project slug is valid before calling save() — resolve_ads_path() in the
route layer provides that guarantee.

Public interface:
  save(project_slug, filename, content) -> dict  write file; return metadata.
"""
from __future__ import annotations

import uuid
from pathlib import Path

from features.web_gui.settings import uploads_dir

_KIND_MAP: dict[str, str] = {
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".svg": "logo",
    ".pdf": "doc",
    ".mp4": "video",
}


def _kind_for(ext: str) -> str:
    """Return the asset kind string for a file extension (lower-cased, with dot).

    Raises ValueError for unsupported extensions — caller maps to 415.
    """
    kind = _KIND_MAP.get(ext.lower())
    if kind is None:
        raise ValueError(f"unsupported extension: {ext!r}")
    return kind


def save(project_slug: str, filename: str, content: bytes) -> dict:
    """Write *content* under uploads_dir()/<project_slug>/<file_id>_<filename>.

    Defense-in-depth: sanitises filename with Path.name inside this function
    even though the route layer already does so.

    Raises:
      ValueError — empty filename after sanitisation, or unsupported extension.
    """
    safe_name = Path(filename).name
    if not safe_name:
        raise ValueError(f"filename {filename!r} is empty after path sanitisation")

    ext = Path(safe_name).suffix
    kind = _kind_for(ext)

    file_id = uuid.uuid4().hex
    dest_dir = uploads_dir() / project_slug
    dest_dir.mkdir(parents=True, exist_ok=True)

    dest = dest_dir / f"{file_id}_{safe_name}"
    dest.write_bytes(content)

    return {
        "file_id": file_id,
        "filename": safe_name,
        "size": len(content),
        "kind": kind,
        "path": str(dest),
    }
