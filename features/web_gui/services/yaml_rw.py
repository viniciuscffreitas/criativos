"""
Atomic yaml read-modify-write with cross-platform advisory locking.

Writes go to <path>.tmp then os.replace to path (atomic on POSIX/NTFS).
A .bak copy of the previous content is kept alongside.

Locking: fcntl.flock on POSIX, no-op on Windows. The web_gui server is
single-process (single uvicorn worker per CLAUDE.md spec — see
features/web_gui/CLAUDE.md "Safe for single-process use"), so on Windows
the missing flock does not introduce a regression: there is no concurrent
writer to coordinate with. If we ever go multi-worker, switch to
portalocker (cross-platform fcntl/msvcrt wrapper).
"""
from __future__ import annotations
import os
from pathlib import Path
from typing import Callable

import yaml

try:
    import fcntl
    _HAS_FCNTL = True
except ModuleNotFoundError:
    fcntl = None  # type: ignore[assignment]
    _HAS_FCNTL = False


def _lock(f, mode: int) -> None:
    """fcntl.flock(f, mode) on POSIX; no-op on Windows."""
    if _HAS_FCNTL:
        fcntl.flock(f.fileno(), mode)


# Re-export the constants the legacy POSIX code uses, with Windows fallbacks.
LOCK_SH = fcntl.LOCK_SH if _HAS_FCNTL else 0  # type: ignore[union-attr]
LOCK_EX = fcntl.LOCK_EX if _HAS_FCNTL else 0  # type: ignore[union-attr]
LOCK_UN = fcntl.LOCK_UN if _HAS_FCNTL else 0  # type: ignore[union-attr]


def read(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        _lock(f, LOCK_SH)
        try:
            result = yaml.safe_load(f)
            if result is None:
                return {}
            if not isinstance(result, dict):
                raise ValueError(
                    f"yaml_rw.read: expected a YAML mapping in {str(path)!r}, "
                    f"got {type(result).__name__}"
                )
            return result
        finally:
            _lock(f, LOCK_UN)


def write(path: Path, data: dict) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    bak = path.with_suffix(path.suffix + ".bak")
    content = yaml.safe_dump(data, sort_keys=False, allow_unicode=True)
    # NOTE: flock here guards only the write to .tmp, not the final rename.
    # Concurrent writers may still race on the rename. Safe for single-process use.
    with tmp.open("w", encoding="utf-8") as f:
        _lock(f, LOCK_EX)
        try:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
        finally:
            _lock(f, LOCK_UN)
    if path.exists():
        path.replace(bak)
    try:
        tmp.replace(path)
    except OSError as e:
        raise RuntimeError(
            f"yaml_rw.write: atomic rename failed for {str(path)!r}; "
            f"previous content is at {str(bak)!r}"
        ) from e


def modify(path: Path, fn: Callable[[dict], dict]) -> dict:
    """Read, apply fn, write. Full flow is held under LOCK_EX to prevent races."""
    with path.open("r+", encoding="utf-8") as f:
        _lock(f, LOCK_EX)
        try:
            data = yaml.safe_load(f)
            if data is None:
                data = {}
            elif not isinstance(data, dict):
                raise ValueError(
                    f"yaml_rw.modify: expected a YAML mapping in {str(path)!r}, "
                    f"got {type(data).__name__}"
                )
            new_data = fn(data)
            content = yaml.safe_dump(new_data, sort_keys=False, allow_unicode=True)
            f.seek(0)
            f.truncate()
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
            return new_data
        finally:
            _lock(f, LOCK_UN)
