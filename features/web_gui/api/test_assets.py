"""Colocated unit tests for api/assets.py — constants, allowlist, list+delete routes."""
from __future__ import annotations

import pytest
import yaml
from fastapi.testclient import TestClient

from features.web_gui.api.assets import _ALLOWED_MIME, _MAX_BYTES
from features.web_gui.server import create_app
from features.web_gui.services import asset_store


def test_max_bytes_is_10mb():
    assert _MAX_BYTES == 10 * 1024 * 1024


def test_allowed_mime_contains_expected_types():
    assert "image/png" in _ALLOWED_MIME
    assert "image/jpeg" in _ALLOWED_MIME
    assert "image/svg+xml" in _ALLOWED_MIME
    assert "application/pdf" in _ALLOWED_MIME
    assert "video/mp4" in _ALLOWED_MIME


def test_exe_not_in_allowed_mime():
    assert "application/octet-stream" not in _ALLOWED_MIME
    assert "application/x-msdownload" not in _ALLOWED_MIME


# ── list + delete routes ───────────────────────────────────────────────────


@pytest.fixture
def client(tmp_path, monkeypatch):
    """Wire up an isolated client with a fresh projects.yaml + uploads dir."""
    projects = tmp_path / "projects.yaml"
    ads = tmp_path / "ads.yaml"
    projects.write_text(yaml.safe_dump({
        "projects": {"vibeweb": {
            "slug": "vibeweb", "name": "Vibe Web", "description": "",
            "ads_path": str(ads), "renders_path": str(tmp_path / "renders"),
            "brand_path": str(tmp_path / "brand"),
            "created_at": "2026-04-18T00:00:00Z",
        }}
    }))
    ads.write_text(yaml.safe_dump({"ads": {}}))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))
    monkeypatch.setattr(asset_store, "uploads_dir", lambda: tmp_path / "uploads")
    return TestClient(create_app()), tmp_path


def test_list_assets_returns_empty_when_no_uploads(client):
    c, _ = client
    r = c.get("/api/v1/projects/vibeweb/assets")
    assert r.status_code == 200
    assert r.json() == {"assets": []}


def test_list_assets_returns_uploaded_files(client):
    c, _ = client
    asset_store.save("vibeweb", "logo.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 12)
    asset_store.save("vibeweb", "ic.svg", b"<svg/>")

    r = c.get("/api/v1/projects/vibeweb/assets")
    assert r.status_code == 200
    body = r.json()
    assert len(body["assets"]) == 2
    by_name = {a["filename"]: a for a in body["assets"]}
    assert by_name["logo.png"]["kind"] == "image"
    assert by_name["ic.svg"]["kind"] == "logo"
    assert all(len(a["file_id"]) == 32 for a in body["assets"])


def test_list_assets_for_unknown_project_returns_404(client):
    c, _ = client
    r = c.get("/api/v1/projects/ghost/assets")
    assert r.status_code == 404
    assert r.json()["code"] == "PROJECT_NOT_FOUND"


def test_delete_asset_removes_file(client):
    c, _ = client
    saved = asset_store.save("vibeweb", "logo.png", b"\x89PNG\r\n\x1a\n")
    r = c.delete(f"/api/v1/projects/vibeweb/assets/{saved['file_id']}")
    assert r.status_code == 204
    assert asset_store.list_("vibeweb") == []


def test_delete_unknown_asset_returns_404(client):
    c, _ = client
    r = c.delete("/api/v1/projects/vibeweb/assets/" + "deadbeef" * 4)
    assert r.status_code == 404
    assert r.json()["code"] == "ASSET_NOT_FOUND"


def test_delete_asset_for_unknown_project_returns_404(client):
    c, _ = client
    r = c.delete("/api/v1/projects/ghost/assets/" + "deadbeef" * 4)
    assert r.status_code == 404
    assert r.json()["code"] == "PROJECT_NOT_FOUND"


def test_delete_asset_with_invalid_file_id_returns_400(client):
    c, _ = client
    # A non-hex id must be rejected with INVALID_FILE_ID at the route layer.
    # The API's error handler unwraps HTTPException.detail into the body
    # directly, so the response is {"error": ..., "code": ...} (no "detail").
    r = c.delete("/api/v1/projects/vibeweb/assets/not-a-valid-hex-id")
    assert r.status_code == 400
    assert r.json()["code"] == "INVALID_FILE_ID"
