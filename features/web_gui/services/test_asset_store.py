"""Colocated unit tests for services/asset_store.py."""
from __future__ import annotations

import pytest

from features.web_gui.services import asset_store


def test_save_round_trip(tmp_path, monkeypatch):
    monkeypatch.setattr(asset_store, "uploads_dir", lambda: tmp_path)
    content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
    result = asset_store.save("vibeweb", "banner.png", content)

    assert result["filename"] == "banner.png"
    assert result["size"] == len(content)
    assert result["kind"] == "image"
    assert result["file_id"]  # non-empty hex string

    saved = (tmp_path / "vibeweb" / f"{result['file_id']}_banner.png").read_bytes()
    assert saved == content


def test_unsupported_extension_raises_value_error(tmp_path, monkeypatch):
    monkeypatch.setattr(asset_store, "uploads_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="unsupported extension"):
        asset_store.save("vibeweb", "payload.exe", b"MZ")


def test_empty_filename_raises_value_error(tmp_path, monkeypatch):
    monkeypatch.setattr(asset_store, "uploads_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="empty after path sanitisation"):
        asset_store.save("vibeweb", "", b"data")


def test_uuid_uniqueness(tmp_path, monkeypatch):
    monkeypatch.setattr(asset_store, "uploads_dir", lambda: tmp_path)
    content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 4
    r1 = asset_store.save("vibeweb", "a.png", content)
    r2 = asset_store.save("vibeweb", "a.png", content)
    assert r1["file_id"] != r2["file_id"]


def test_path_traversal_in_filename_is_stripped(tmp_path, monkeypatch):
    monkeypatch.setattr(asset_store, "uploads_dir", lambda: tmp_path)
    content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 4
    result = asset_store.save("vibeweb", "../../evil.png", content)
    assert result["filename"] == "evil.png"
    dest = tmp_path / "vibeweb" / f"{result['file_id']}_evil.png"
    assert dest.exists()
