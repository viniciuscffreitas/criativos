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


def test_list_returns_empty_when_no_uploads(tmp_path, monkeypatch):
    monkeypatch.setattr(asset_store, "uploads_dir", lambda: tmp_path)
    assert asset_store.list_("vibeweb") == []


def test_list_returns_metadata_for_each_upload(tmp_path, monkeypatch):
    monkeypatch.setattr(asset_store, "uploads_dir", lambda: tmp_path)
    asset_store.save("vibeweb", "a.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 8)
    asset_store.save("vibeweb", "b.svg", b"<svg/>")
    items = asset_store.list_("vibeweb")
    assert len(items) == 2
    by_name = {it["filename"]: it for it in items}
    assert by_name["a.png"]["kind"] == "image"
    assert by_name["b.svg"]["kind"] == "logo"
    # file_id is the uuid prefix; reconstructable from disk filename
    assert all(len(it["file_id"]) == 32 for it in items)
    # size matches actual bytes
    assert by_name["a.png"]["size"] == len(b"\x89PNG\r\n\x1a\n" + b"\x00" * 8)


def test_list_skips_subdirectories_and_non_files(tmp_path, monkeypatch):
    monkeypatch.setattr(asset_store, "uploads_dir", lambda: tmp_path)
    asset_store.save("vibeweb", "ok.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 4)
    # Plant a subdirectory and a file with no underscore (legacy).
    (tmp_path / "vibeweb" / "subdir").mkdir()
    (tmp_path / "vibeweb" / "no_underscore.png").write_bytes(b"x")
    items = asset_store.list_("vibeweb")
    assert len(items) == 1
    assert items[0]["filename"] == "ok.png"


def test_delete_removes_file_and_returns_true(tmp_path, monkeypatch):
    monkeypatch.setattr(asset_store, "uploads_dir", lambda: tmp_path)
    saved = asset_store.save("vibeweb", "a.png", b"\x89PNG\r\n\x1a\n")
    assert asset_store.delete("vibeweb", saved["file_id"]) is True
    assert asset_store.list_("vibeweb") == []


def test_delete_unknown_file_id_returns_false(tmp_path, monkeypatch):
    monkeypatch.setattr(asset_store, "uploads_dir", lambda: tmp_path)
    assert asset_store.delete("vibeweb", "deadbeef" * 4) is False


def test_delete_rejects_path_traversal_in_file_id(tmp_path, monkeypatch):
    monkeypatch.setattr(asset_store, "uploads_dir", lambda: tmp_path)
    asset_store.save("vibeweb", "a.png", b"\x89PNG\r\n\x1a\n")
    # Reject anything that isn't a hex uuid prefix — defense in depth.
    assert asset_store.delete("vibeweb", "../etc") is False
    assert asset_store.delete("vibeweb", "..") is False
    assert asset_store.delete("vibeweb", "") is False
    # File still present.
    assert len(asset_store.list_("vibeweb")) == 1
