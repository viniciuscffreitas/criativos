"""Colocated unit tests for api/traces.py — path-traversal guard and regex."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from features.web_gui.api.traces import _RUN_ID_RE


@pytest.mark.parametrize("run_id", [
    "abc123",
    "run-abc-123",
    "run_abc_123",
    "A" * 64,
])
def test_valid_run_ids_match(run_id):
    assert _RUN_ID_RE.fullmatch(run_id) is not None


@pytest.mark.parametrize("run_id", [
    "../etc",
    "run/bad",
    "run bad",
    "",
    "A" * 65,
    "run.id",
])
def test_invalid_run_ids_do_not_match(run_id):
    assert _RUN_ID_RE.fullmatch(run_id) is None
