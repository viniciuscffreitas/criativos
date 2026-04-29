"""Persist uploaded creative assets to disk.

Each saved file gets a uuid4 hex file_id; the original filename is sanitised
(Path.name strips any directory components). Caller is responsible for ensuring
the project slug is valid before calling save() — resolve_ads_path() in the
route layer provides that guarantee.

Disk layout: uploads_dir() / <project_slug> / <file_id>_<filename>
  - file_id is a 32-char hex (uuid4().hex)
  - filename is the original sanitised filename
  - Splitting on the first underscore recovers (file_id, filename) pairs.

Public interface:
  save(project_slug, filename, content) -> dict   write file; return metadata.
  list_(project_slug)                  -> list   metadata of every upload.
  delete(project_slug, file_id)        -> bool   True if a file was removed.
"""
from __future__ import annotations

import re
import uuid
from pathlib import Path

from features.web_gui.settings import uploads_dir

# A valid file_id is exactly the uuid4().hex format we generate at save() time:
# 32 lower-case hex digits. Anything else is rejected on delete to prevent
# path-traversal or accidentally hitting unrelated files.
_FILE_ID_RE = re.compile(r"^[0-9a-f]{32}$")

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


def _split_disk_name(disk_name: str) -> tuple[str, str] | None:
    """Recover (file_id, filename) from a disk filename like
    "<32-hex>_<original>". Return None if the filename doesn't match the
    pattern (legacy file, partial write, etc).
    """
    sep = disk_name.find("_")
    if sep != 32:
        return None
    file_id, filename = disk_name[:sep], disk_name[sep + 1:]
    if not _FILE_ID_RE.match(file_id) or not filename:
        return None
    return file_id, filename


def list_(project_slug: str) -> list[dict]:
    """Return metadata for every upload under the given slug.

    Skips subdirectories and any file whose name doesn't match the
    "<file_id>_<filename>" convention. Order is filesystem-dependent;
    callers that care about order should sort by created_at or filename.
    """
    project_dir = uploads_dir() / project_slug
    if not project_dir.exists():
        return []

    out: list[dict] = []
    for entry in project_dir.iterdir():
        if not entry.is_file():
            continue
        parts = _split_disk_name(entry.name)
        if parts is None:
            continue
        file_id, filename = parts
        try:
            kind = _kind_for(Path(filename).suffix)
        except ValueError:
            # File on disk has an extension we no longer recognise — skip
            # (don't crash list_) so the UI can still render uploads.
            continue
        out.append({
            "file_id": file_id,
            "filename": filename,
            "size": entry.stat().st_size,
            "kind": kind,
            "path": str(entry),
        })
    return out


def delete(project_slug: str, file_id: str) -> bool:
    """Delete the upload identified by file_id under the given slug.

    Returns True if a file was removed; False if no upload matched
    (including when file_id is malformed — defense against path traversal).
    """
    if not _FILE_ID_RE.match(file_id):
        return False
    project_dir = uploads_dir() / project_slug
    if not project_dir.exists():
        return False
    # We use glob with the file_id prefix; the underscore disambiguates from
    # any future ids that could share a prefix (uuid4 doesn't, but we keep
    # the underscore to be explicit about the boundary).
    matches = list(project_dir.glob(f"{file_id}_*"))
    if not matches:
        return False
    for m in matches:
        if m.is_file():
            m.unlink()
    return True
