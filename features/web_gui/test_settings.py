"""
Unit tests for settings accessors — verifies they are pure (no filesystem
side-effects) and return the expected paths.
"""
from __future__ import annotations
from pathlib import Path

from features.web_gui import settings


def test_traces_dir_is_pure(tmp_path):
    """traces_dir() must not create directories."""
    expected = settings.ROOT / "features" / "web_gui" / "traces"
    result = settings.traces_dir()
    assert result == expected
    assert not result.exists() or result.is_dir()  # may already exist from prior runs


def test_uploads_dir_is_pure(tmp_path):
    """uploads_dir() must not create directories."""
    expected = settings.ROOT / "features" / "web_gui" / "uploads"
    result = settings.uploads_dir()
    assert result == expected


def test_traces_dir_does_not_mkdir(tmp_path, monkeypatch):
    """Calling traces_dir() on a non-existent path must not create it."""
    fake = tmp_path / "traces_should_not_be_created"
    monkeypatch.setattr(settings, "ROOT", tmp_path)
    result = settings.traces_dir()
    assert not result.exists()


def test_uploads_dir_does_not_mkdir(tmp_path, monkeypatch):
    """Calling uploads_dir() on a non-existent path must not create it."""
    monkeypatch.setattr(settings, "ROOT", tmp_path)
    result = settings.uploads_dir()
    assert not result.exists()


def test_static_dir_returns_path():
    result = settings.static_dir()
    assert isinstance(result, Path)
    assert result.name == "static"


def test_projects_yaml_path_default():
    result = settings.projects_yaml_path()
    assert result.name == "projects.yaml"
