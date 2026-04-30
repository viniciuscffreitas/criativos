"""Tests for the render service that wraps the existing async pipelines.

Playwright is mocked in every test — we never spawn a real browser here.
Integration that actually launches chromium lives in tests/test_visual_regression.py.
"""
from __future__ import annotations

import pytest

from features.web_gui.services import render_service


# ---------------------------------------------------------------------------
# manifest()
# ---------------------------------------------------------------------------

def test_manifest_lists_all_categories():
    m = render_service.manifest()
    assert set(m) == {
        "brand-logos", "brand-social", "brand-favicons",
        "meta-ads", "instagram",
    }


def test_manifest_brand_logos_count():
    m = render_service.manifest()
    # vibeweb-primary.png + vibeweb-icon.png
    assert len(m["brand-logos"]) == 2
    paths = {item.relative_path for item in m["brand-logos"]}
    assert "logos/vibeweb-primary.png" in paths
    assert "logos/vibeweb-icon.png" in paths


def test_manifest_brand_social_count():
    m = render_service.manifest()
    # 1 post + 1 story + 5 highlights + linkedin + og-image
    assert len(m["brand-social"]) == 9


def test_manifest_brand_favicons_count():
    m = render_service.manifest()
    assert len(m["brand-favicons"]) == 4


def test_manifest_meta_ads_count():
    m = render_service.manifest()
    # config/ads.yaml has 6 ads
    assert len(m["meta-ads"]) == 6
    paths = {item.relative_path for item in m["meta-ads"]}
    assert "01-portfolio-grid.png" in paths


def test_manifest_instagram_count():
    m = render_service.manifest()
    # 6 grid singles + 21 carousel slides + 1 avatar + 5 highlights + 15 stories
    assert len(m["instagram"]) == 48


def test_manifest_render_item_carries_dimensions():
    m = render_service.manifest()
    posts = [it for it in m["brand-social"] if it.relative_path.endswith("instagram-post.png")]
    assert len(posts) == 1
    assert posts[0].width == 1080
    assert posts[0].height == 1080


# ---------------------------------------------------------------------------
# render_meta_ads / render_instagram (Playwright mocked)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_render_meta_ads_filters_by_ad_id(monkeypatch):
    captured: list = []

    async def _fake_run_jobs(jobs):
        captured.extend(jobs)
        for j in jobs:
            j.out.parent.mkdir(parents=True, exist_ok=True)
            j.out.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 8)

    monkeypatch.setattr(render_service, "run_jobs", _fake_run_jobs)
    report = await render_service.render_meta_ads(ad_id="01")
    assert report.category == "meta-ads"
    assert report.total == 1
    assert report.ok_count == 1
    assert len(captured) == 1
    assert captured[0].out.name.startswith("01-")


@pytest.mark.asyncio
async def test_render_meta_ads_unknown_ad_id_raises(monkeypatch):
    async def _noop(jobs):
        pass

    monkeypatch.setattr(render_service, "run_jobs", _noop)
    with pytest.raises(LookupError, match="ad_id"):
        await render_service.render_meta_ads(ad_id="99")


@pytest.mark.asyncio
async def test_render_meta_ads_runs_all_when_no_filter(monkeypatch):
    captured: list = []

    async def _fake_run_jobs(jobs):
        captured.extend(jobs)
        for j in jobs:
            j.out.parent.mkdir(parents=True, exist_ok=True)
            j.out.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 8)

    monkeypatch.setattr(render_service, "run_jobs", _fake_run_jobs)
    report = await render_service.render_meta_ads()
    assert report.total == 6
    assert report.ok_count == 6


@pytest.mark.asyncio
async def test_render_instagram_filters_by_stem(monkeypatch):
    captured: list = []

    async def _fake_run_jobs(jobs):
        captured.extend(jobs)
        for j in jobs:
            j.out.parent.mkdir(parents=True, exist_ok=True)
            j.out.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 8)

    monkeypatch.setattr(render_service, "run_jobs", _fake_run_jobs)
    report = await render_service.render_instagram(stem="single-manifesto")
    assert report.total == 1
    assert all("manifesto" in r.item.relative_path for r in report.results)


@pytest.mark.asyncio
async def test_render_instagram_unknown_stem_raises(monkeypatch):
    async def _noop(jobs):
        pass

    monkeypatch.setattr(render_service, "run_jobs", _noop)
    with pytest.raises(LookupError, match="stem"):
        await render_service.render_instagram(stem="ghost-not-real")


# ---------------------------------------------------------------------------
# render_brand_pack (delegates to scripts.generate.main)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_render_brand_pack_returns_full_manifest(monkeypatch):
    """Stub _brand_main so playwright doesn't fire; write fake bytes to expected paths."""
    async def _fake_main():
        for cat in ("brand-logos", "brand-social", "brand-favicons"):
            for it in render_service.manifest()[cat]:
                it.absolute_path.parent.mkdir(parents=True, exist_ok=True)
                it.absolute_path.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 8)

    monkeypatch.setattr(render_service, "_brand_main", _fake_main)
    report = await render_service.render_brand_pack()
    assert report.category == "brand-pack"
    assert report.total == 2 + 9 + 4  # 15
    # ok_count depends on whether files already existed; the fake_main writes
    # fresh bytes so all should be ok.
    assert report.ok_count == report.total


@pytest.mark.asyncio
async def test_render_brand_pack_swallows_systemexit(monkeypatch):
    """scripts.generate.main calls sys.exit(1) on partial failure — service must
    keep going and let _verify_results report what's missing."""
    async def _fake_main_partial():
        # Write only logos, leave social/favicons missing.
        for it in render_service.manifest()["brand-logos"]:
            it.absolute_path.parent.mkdir(parents=True, exist_ok=True)
            it.absolute_path.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 8)
        raise SystemExit(1)

    monkeypatch.setattr(render_service, "_brand_main", _fake_main_partial)
    report = await render_service.render_brand_pack()
    # ok_count >= 2 (logos), total = 15 — proves SystemExit didn't propagate.
    assert report.ok_count >= 2
    assert report.total == 15


# ---------------------------------------------------------------------------
# render_all (aggregates)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_render_all_aggregates_all_categories(monkeypatch):
    async def _fake_brand():
        for cat in ("brand-logos", "brand-social", "brand-favicons"):
            for it in render_service.manifest()[cat]:
                it.absolute_path.parent.mkdir(parents=True, exist_ok=True)
                it.absolute_path.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 8)

    async def _fake_run_jobs(jobs):
        for j in jobs:
            j.out.parent.mkdir(parents=True, exist_ok=True)
            j.out.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 8)

    monkeypatch.setattr(render_service, "_brand_main", _fake_brand)
    monkeypatch.setattr(render_service, "run_jobs", _fake_run_jobs)
    report = await render_service.render_all()
    assert report.category == "all"
    assert report.total == 15 + 6 + 48  # 69
    assert report.ok_count == report.total
