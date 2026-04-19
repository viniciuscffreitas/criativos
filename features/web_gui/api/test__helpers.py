"""Colocated unit tests for api/_helpers.py — find_ad_key and iter_ads_paths."""
from __future__ import annotations

import pytest
import yaml
from fastapi import HTTPException

from features.web_gui.api._helpers import find_ad_key, iter_ads_paths


# ---------------------------------------------------------------------------
# find_ad_key
# ---------------------------------------------------------------------------

def test_find_ad_key_returns_correct_key():
    data = {"ads": {"01_grid": {"id": "01"}, "02_story": {"id": "02"}}}
    assert find_ad_key(data, "01") == "01_grid"
    assert find_ad_key(data, "02") == "02_story"


def test_find_ad_key_raises_404_on_missing_id():
    data = {"ads": {"01_grid": {"id": "01"}}}
    with pytest.raises(HTTPException) as exc_info:
        find_ad_key(data, "99")
    assert exc_info.value.status_code == 404
    assert exc_info.value.detail["code"] == "AD_NOT_FOUND"


def test_find_ad_key_empty_ads_raises_404():
    with pytest.raises(HTTPException) as exc_info:
        find_ad_key({}, "01")
    assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# iter_ads_paths
# ---------------------------------------------------------------------------

def test_iter_ads_paths_yields_slug_and_path(tmp_path, monkeypatch):
    ads = tmp_path / "ads.yaml"
    ads.write_text(yaml.safe_dump({"ads": {}}))
    projects = tmp_path / "projects.yaml"
    projects.write_text(yaml.safe_dump({
        "projects": {"vibeweb": {"ads_path": str(ads)}}
    }))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))

    results = list(iter_ads_paths())
    assert len(results) == 1
    slug, path = results[0]
    assert slug == "vibeweb"
    assert path == ads


def test_iter_ads_paths_raises_500_for_missing_ads_path(tmp_path, monkeypatch):
    projects = tmp_path / "projects.yaml"
    projects.write_text(yaml.safe_dump({
        "projects": {"vibeweb": {"name": "Vibe Web"}}  # no ads_path
    }))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))

    with pytest.raises(HTTPException) as exc_info:
        list(iter_ads_paths())
    assert exc_info.value.status_code == 500
    assert exc_info.value.detail["code"] == "PROJECT_MISCONFIGURED"
