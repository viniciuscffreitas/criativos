"""Traces route — GET /api/v1/traces/{run_id}.

Returns the full JSON trace for a completed agent run.

Routes:
  GET /api/v1/traces/{run_id}
"""
from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException

from features.web_gui.services import trace_store
from features.web_gui.settings import traces_dir

router = APIRouter(tags=["traces"])

_RUN_ID_RE = re.compile(r"[A-Za-z0-9_-]{1,64}")


@router.get("/traces/{run_id}")
def get_trace(run_id: str):
    if not _RUN_ID_RE.fullmatch(run_id):
        raise HTTPException(
            status_code=400,
            detail={"error": f"run_id {run_id!r} contains invalid characters", "code": "INVALID_RUN_ID"},
        )
    try:
        data = trace_store.load(run_id)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail={"error": f"trace {run_id!r} not found", "code": "TRACE_NOT_FOUND"},
        )
    return data
