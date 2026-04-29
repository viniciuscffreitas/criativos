"""Colocated unit tests for api/brand_files.py — DELETE /brand-files."""
from __future__ import annotations

import pytest
import yaml
from fastapi.testclient import TestClient

from features.web_gui import settings
from features.web_gui.server import create_app


@pytest.fixture
def client_with_brand(tmp_path, monkeypatch):
    """Wire up an isolated client with a fake brand/ tree."""
    projects = tmp_path / "projects.yaml"
    ads = tmp_path / "ads.yaml"
    brand = tmp_path / "brand"
    (brand / "logos").mkdir(parents=True)
    (brand / "logos" / "vibeweb-icon.svg").write_text("<svg/>")
    (brand / "tokens.css").write_text("/* tokens */")

    projects.write_text(yaml.safe_dump({
        "projects": {"vibeweb": {
            "slug": "vibeweb", "name": "Vibe Web", "description": "",
            "ads_path": str(ads), "renders_path": str(tmp_path / "renders"),
            "brand_path": str(brand),
            "created_at": "2026-04-18T00:00:00Z",
        }}
    }))
    ads.write_text(yaml.safe_dump({"ads": {}}))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))
    # Repoint brand_dir() at our fake tree.
    monkeypatch.setattr(settings, "brand_dir", lambda: brand)
    monkeypatch.setattr(
        "features.web_gui.api.brand_files.brand_dir", lambda: brand,
    )
    return TestClient(create_app()), brand


def test_delete_existing_file_returns_204(client_with_brand):
    c, brand = client_with_brand
    target = brand / "logos" / "vibeweb-icon.svg"
    assert target.exists()
    r = c.request("DELETE", "/api/v1/brand-files", json={"path": "logos/vibeweb-icon.svg"})
    assert r.status_code == 204
    assert not target.exists()


def test_delete_missing_file_returns_404(client_with_brand):
    c, _ = client_with_brand
    r = c.request("DELETE", "/api/v1/brand-files", json={"path": "logos/no-such.png"})
    assert r.status_code == 404
    assert r.json()["code"] == "NOT_FOUND"


def test_delete_path_traversal_returns_400(client_with_brand):
    c, _ = client_with_brand
    r = c.request("DELETE", "/api/v1/brand-files", json={"path": "../etc/passwd"})
    assert r.status_code == 400
    assert r.json()["code"] == "INVALID_PATH"


def test_delete_absolute_path_returns_400(client_with_brand):
    c, _ = client_with_brand
    r = c.request("DELETE", "/api/v1/brand-files", json={"path": "/etc/hosts"})
    assert r.status_code == 400
    assert r.json()["code"] == "INVALID_PATH"


def test_delete_protected_tokens_css_returns_403(client_with_brand):
    c, brand = client_with_brand
    r = c.request("DELETE", "/api/v1/brand-files", json={"path": "tokens.css"})
    assert r.status_code == 403
    assert r.json()["code"] == "PROTECTED_PATH"
    # File must still exist.
    assert (brand / "tokens.css").exists()


def test_delete_empty_path_returns_400(client_with_brand):
    c, _ = client_with_brand
    r = c.request("DELETE", "/api/v1/brand-files", json={"path": ""})
    assert r.status_code == 400
    assert r.json()["code"] == "INVALID_PATH"


def test_delete_missing_path_field_returns_400(client_with_brand):
    c, _ = client_with_brand
    r = c.request("DELETE", "/api/v1/brand-files", json={})
    assert r.status_code == 400
    assert r.json()["code"] == "INVALID_PATH"
