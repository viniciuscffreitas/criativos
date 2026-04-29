"""Tests for the shared api helpers."""
from pathlib import Path

import pytest
import yaml
from fastapi import HTTPException

from features.web_gui.api._helpers import resolve_ads_path


def test_resolve_ads_path_returns_absolute(tmp_path, monkeypatch):
    projects = tmp_path / "projects.yaml"
    ads = tmp_path / "ads.yaml"
    projects.write_text(yaml.safe_dump({"projects": {"vibeweb": {
        "slug": "vibeweb", "ads_path": str(ads),
    }}}))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))
    result = resolve_ads_path("vibeweb")
    assert result == Path(str(ads))


def test_resolve_ads_path_relative_resolved_against_config_dir(tmp_path, monkeypatch):
    config = tmp_path / "config"
    config.mkdir()
    projects = config / "projects.yaml"
    projects.write_text(yaml.safe_dump({"projects": {"vibeweb": {
        "slug": "vibeweb", "ads_path": "ads.yaml",
    }}}))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))
    result = resolve_ads_path("vibeweb")
    assert result == config / "ads.yaml"


def test_resolve_ads_path_unknown_slug_raises_404(tmp_path, monkeypatch):
    projects = tmp_path / "projects.yaml"
    projects.write_text(yaml.safe_dump({"projects": {}}))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))
    with pytest.raises(HTTPException) as exc:
        resolve_ads_path("ghost")
    assert exc.value.status_code == 404
    assert exc.value.detail["code"] == "PROJECT_NOT_FOUND"


def test_resolve_ads_path_missing_ads_path_raises_500(tmp_path, monkeypatch):
    projects = tmp_path / "projects.yaml"
    projects.write_text(yaml.safe_dump({"projects": {"vibeweb": {"slug": "vibeweb"}}}))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))
    with pytest.raises(HTTPException) as exc:
        resolve_ads_path("vibeweb")
    assert exc.value.status_code == 500
    assert exc.value.detail["code"] == "PROJECT_MISCONFIGURED"
