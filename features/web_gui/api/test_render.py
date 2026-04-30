"""Contract tests for /api/v1/render/* — render_service is mocked in every
test except the manifest one (which only enumerates, no rendering).
"""
from __future__ import annotations

import pytest
import yaml
from fastapi.testclient import TestClient

from features.web_gui.server import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    projects = tmp_path / "projects.yaml"
    ads = tmp_path / "ads.yaml"
    projects.write_text(yaml.safe_dump({
        "projects": {"vibeweb": {
            "slug": "vibeweb", "name": "Vibe Web", "description": "",
            "ads_path": str(ads), "renders_path": str(tmp_path / "renders"),
            "brand_path": str(tmp_path / "brand"),
            "created_at": "2026-04-29T00:00:00Z",
        }}
    }))
    ads.write_text(yaml.safe_dump({"ads": {}}))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))
    return TestClient(create_app())


def test_get_manifest_returns_all_categories(client):
    r = client.get("/api/v1/render/manifest")
    assert r.status_code == 200
    body = r.json()
    assert set(body["categories"]) == {
        "brand-logos", "brand-social", "brand-favicons", "meta-ads", "instagram",
    }
    counts = {k: len(v) for k, v in body["categories"].items()}
    assert counts["brand-logos"] == 2
    assert counts["brand-social"] == 9
    assert counts["brand-favicons"] == 4
    assert counts["meta-ads"] == 6
    assert counts["instagram"] == 48


def test_get_manifest_item_shape(client):
    r = client.get("/api/v1/render/manifest")
    body = r.json()
    item = body["categories"]["brand-logos"][0]
    assert {"relative_path", "url", "width", "height", "exists"} <= set(item)


def test_get_manifest_url_uses_correct_static_prefix(client):
    """Each category maps to its own static mount: brand→/brand,
    meta-ads→/renders, instagram→/instagram."""
    r = client.get("/api/v1/render/manifest")
    body = r.json()
    assert body["categories"]["brand-logos"][0]["url"].startswith("/brand/")
    assert body["categories"]["meta-ads"][0]["url"].startswith("/renders/")
    assert body["categories"]["instagram"][0]["url"].startswith("/instagram/")


def test_post_render_brand_calls_service(client, monkeypatch):
    called = {"n": 0}

    async def _fake_brand_pack():
        called["n"] += 1
        from features.web_gui.services.render_service import RenderReport
        return RenderReport("brand-pack", "s", "f", 12, [])

    monkeypatch.setattr(
        "features.web_gui.services.render_service.render_brand_pack",
        _fake_brand_pack,
    )
    r = client.post("/api/v1/render/brand")
    assert r.status_code == 200
    assert called["n"] == 1
    body = r.json()
    assert body["category"] == "brand-pack"
    assert body["ok_count"] == 0
    assert body["total"] == 0


def test_post_render_ads_with_filter(client, monkeypatch):
    captured = {"ad_id": "untouched"}

    async def _fake(ad_id=None):
        captured["ad_id"] = ad_id
        from features.web_gui.services.render_service import RenderReport
        return RenderReport("meta-ads", "s", "f", 12, [])

    monkeypatch.setattr(
        "features.web_gui.services.render_service.render_meta_ads", _fake,
    )
    r = client.post("/api/v1/render/ads?ad_id=01")
    assert r.status_code == 200
    assert captured["ad_id"] == "01"


def test_post_render_ads_unknown_id_returns_404(client, monkeypatch):
    async def _fake(ad_id=None):
        raise LookupError(f"unknown ad_id {ad_id!r}")

    monkeypatch.setattr(
        "features.web_gui.services.render_service.render_meta_ads", _fake,
    )
    r = client.post("/api/v1/render/ads?ad_id=99")
    assert r.status_code == 404
    assert r.json()["code"] == "NOT_FOUND"


def test_post_render_instagram_with_stem(client, monkeypatch):
    captured = {"stem": "untouched"}

    async def _fake(stem=None):
        captured["stem"] = stem
        from features.web_gui.services.render_service import RenderReport
        return RenderReport("instagram", "s", "f", 12, [])

    monkeypatch.setattr(
        "features.web_gui.services.render_service.render_instagram", _fake,
    )
    r = client.post("/api/v1/render/instagram?stem=single-manifesto")
    assert r.status_code == 200
    assert captured["stem"] == "single-manifesto"


def test_post_render_instagram_unknown_stem_404(client, monkeypatch):
    async def _fake(stem=None):
        raise LookupError(f"unknown stem {stem!r}")

    monkeypatch.setattr(
        "features.web_gui.services.render_service.render_instagram", _fake,
    )
    r = client.post("/api/v1/render/instagram?stem=ghost")
    assert r.status_code == 404
    assert r.json()["code"] == "NOT_FOUND"


def test_post_render_all(client, monkeypatch):
    async def _fake_all():
        from features.web_gui.services.render_service import RenderReport
        return RenderReport("all", "s", "f", 12, [])

    monkeypatch.setattr(
        "features.web_gui.services.render_service.render_all", _fake_all,
    )
    r = client.post("/api/v1/render/all")
    assert r.status_code == 200
    assert r.json()["category"] == "all"
