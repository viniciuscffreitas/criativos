"""
Atomic yaml read-modify-write with fcntl.flock.

Writes go to <path>.tmp then os.replace to path (atomic on POSIX).
A .bak copy of the previous content is kept alongside.
"""
from __future__ import annotations
import fcntl
import os
from pathlib import Path
from typing import Callable

import yaml


def read(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_SH)
        try:
            return yaml.safe_load(f) or {}
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)


def write(path: Path, data: dict) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    bak = path.with_suffix(path.suffix + ".bak")
    content = yaml.safe_dump(data, sort_keys=False, allow_unicode=True)
    with tmp.open("w", encoding="utf-8") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        try:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    if path.exists():
        path.replace(bak)
    tmp.replace(path)


def modify(path: Path, fn: Callable[[dict], dict]) -> dict:
    """Read, apply fn, write. Full flow is held under LOCK_EX to prevent races."""
    with path.open("r+", encoding="utf-8") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        try:
            data = yaml.safe_load(f) or {}
            new_data = fn(data)
            content = yaml.safe_dump(new_data, sort_keys=False, allow_unicode=True)
            f.seek(0)
            f.truncate()
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
            return new_data
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
