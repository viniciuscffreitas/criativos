"""
Unit tests for API serializers — verifies field types and explicit-None defaults.
"""
from __future__ import annotations

from features.web_gui.api.serializers import ErrorOut, ProjectListOut, ProjectOut


def test_error_out_raw_defaults_to_none():
    e = ErrorOut(error="something broke", code="SOME_ERROR")
    assert e.raw is None


def test_error_out_raw_accepts_string():
    e = ErrorOut(error="something broke", code="SOME_ERROR", raw="traceback here")
    assert e.raw == "traceback here"


def test_error_out_raw_omitted_from_json_when_none():
    e = ErrorOut(error="x", code="Y")
    data = e.model_dump(exclude_none=True)
    assert "raw" not in data


def test_project_out_model_validate():
    data = {
        "slug": "vibeweb",
        "name": "Vibe Web",
        "description": "desc",
        "ad_count": 3,
        "variant_count": 6,
        "created_at": "2026-04-18T00:00:00Z",
    }
    p = ProjectOut.model_validate(data)
    assert p.slug == "vibeweb"
    assert p.ad_count == 3


def test_project_list_out_empty():
    pl = ProjectListOut(projects=[])
    assert pl.projects == []
