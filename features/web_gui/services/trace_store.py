"""Persist agent run traces to disk as JSON.

Each trace is written atomically (write to .tmp, os.replace to final) so
concurrent runs cannot corrupt a trace file.

Public interface:
  save(run_id, data) -> Path   write trace data; returns the file path.
  load(run_id)       -> dict   read and parse a previously saved trace.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from features.web_gui.settings import traces_dir


def save(run_id: str, data: dict) -> Path:
    """Write *data* as pretty JSON to traces_dir()/<run_id>.json atomically.

    Raises RuntimeError if traces_dir() does not exist — callers must ensure
    the directory is created at startup (create_app() already does this).
    """
    td = traces_dir()
    if not td.exists():
        raise RuntimeError(
            f"traces dir not found: {td!r} — ensure create_app() ran before saving traces"
        )
    path = td / f"{run_id}.json"
    tmp = path.with_suffix(".json.tmp")
    content = json.dumps(data, indent=2, ensure_ascii=False)
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)
    return path


def load(run_id: str) -> dict:
    """Read and return the JSON trace for *run_id*.

    Raises FileNotFoundError if the trace does not exist.
    """
    path = traces_dir() / f"{run_id}.json"
    return json.loads(path.read_text(encoding="utf-8"))
