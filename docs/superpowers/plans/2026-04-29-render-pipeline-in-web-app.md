# Render Pipeline in Web App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the web app capable of triggering and surfacing every asset the
Playwright pipeline already produces (67 PNGs across brand, Meta ads, and
Instagram content) — closing the gap where the UI today only generates AI
copy, not visual creatives.

**Architecture:** Add a thin **render service** in `features/web_gui/services/`
that imports the existing async pipelines (`scripts.generate.main`,
`ads.render.build_jobs`, `features.instagram_content.jobs.build_jobs`) and
returns a structured `RenderReport`. Expose four POST routes
(`/render/brand`, `/render/ads`, `/render/instagram`, `/render/all`) plus a
GET `/render/manifest` enumerating all expected outputs. Mount
`features/instagram_content/renders/` at `/instagram` static. Add a "Studio"
nav section in the React UI that shows the manifest grouped by category and
exposes "Generate all" actions.

**Tech Stack:** Python 3.13 + FastAPI + Playwright (existing async helpers in
`scripts/pipeline.py`) on the backend; React 18 + TypeScript + Vite on the
frontend.

---

## Gap snapshot (what the pipeline produces vs what the UI exposes today)

| Category | Pipeline | Today in web_gui |
|---|---:|---|
| Brand logos (PNG) | 2 | Read-only via `/brand` static |
| Brand social (PNG) | 9 | Read-only via `/brand` static |
| Brand favicons (PNG) | 4 | Read-only via `/brand` static |
| Meta Ads (PNG) | 6 | Read-only via `/renders` static |
| Instagram (PNG) | 48 | **Not exposed at all** |
| **Trigger generation** | CLI only (`python scripts/build.py --all`) | **No API route** |

The UI's existing `/api/v1/generate` is for **AI copy**, not visual rendering.
The `creatives` endpoint reads `ads.yaml` but never produces PNGs.

---

## File structure

**Created**
- `features/web_gui/services/render_service.py` — RenderReport, RenderItem, manifest, async render_brand_pack/ads/instagram/all
- `features/web_gui/services/test_render_service.py` — unit tests (Playwright mocked for fast tests, one slow integration gated by marker)
- `features/web_gui/api/render.py` — FastAPI routes: GET /render/manifest + POST /render/{brand,ads,instagram,all}
- `features/web_gui/api/test_render.py` — contract tests (TestClient, render_service mocked)
- `features/web_gui/ui/src/components/Studio.tsx` — new view: 3 category sections + Generate button + status grid
- `features/web_gui/ui/src/components/Studio.test.tsx` — vitest

**Modified**
- `features/web_gui/server.py` — register render router + mount `/instagram` static
- `features/web_gui/api/__init__.py` — re-export render
- `features/web_gui/test_server.py` — assert /instagram mount, /render router visible
- `features/web_gui/ui/src/api.ts` — add renderBrand / renderAds / renderInstagram / renderAll / getRenderManifest
- `features/web_gui/ui/src/api.test.ts` — vitest covering new methods
- `features/web_gui/ui/src/types.ts` — RenderItem, RenderReport, RenderManifest
- `features/web_gui/ui/src/components/Sidebar.tsx` — add 'studio' nav entry (shortcut ⌘4)
- `features/web_gui/ui/src/App.tsx` — wire 'studio' route + ⌘4 keybinding
- `features/web_gui/ui/src/components/Sidebar.test.tsx` — assert new nav item
- `features/web_gui/ui/src/App.test.tsx` — assert ⌘4 routes to Studio

**No CLI behavior change.** `python scripts/build.py --all` keeps working;
the service simply imports its building blocks.

---

## Task 1: RenderItem / RenderReport / manifest enumeration

**Files:**
- Create: `features/web_gui/services/render_service.py`
- Test: `features/web_gui/services/test_render_service.py`

- [ ] **Step 1: RED — write failing manifest test**

```python
# features/web_gui/services/test_render_service.py
from features.web_gui.services import render_service


def test_manifest_lists_all_categories():
    m = render_service.manifest()
    assert set(m) == {"brand-logos", "brand-social", "brand-favicons", "meta-ads", "instagram"}


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


def test_manifest_meta_ads_count(monkeypatch):
    m = render_service.manifest()
    # config/ads.yaml has 6 ads
    assert len(m["meta-ads"]) == 6
    paths = {item.relative_path for item in m["meta-ads"]}
    assert "01-portfolio-grid.png" in paths


def test_manifest_instagram_count():
    m = render_service.manifest()
    # 27 grid posts + 1 avatar + 5 highlights + 15 stories
    assert len(m["instagram"]) == 48


def test_render_item_carries_dimensions():
    m = render_service.manifest()
    posts = [it for it in m["brand-social"] if it.relative_path.endswith("instagram-post.png")]
    assert len(posts) == 1
    assert posts[0].width == 1080
    assert posts[0].height == 1080
```

- [ ] **Step 2: Run — must FAIL with import error**

`pytest features/web_gui/services/test_render_service.py -v`
Expected: ImportError or ModuleNotFoundError.

- [ ] **Step 3: GREEN — implement manifest()**

```python
# features/web_gui/services/render_service.py
"""Render service — wraps existing pipelines for HTTP-driven invocation.

Exposes:
  - manifest()                — enumerates every PNG the pipeline can produce
  - async render_brand_pack() — runs scripts.generate.main()
  - async render_meta_ads(ad_id=None)   — uses ads.render.build_jobs()
  - async render_instagram(stem=None)   — uses features.instagram_content.jobs.build_jobs()
  - async render_all()                  — runs the three above in sequence

The service does NOT spawn subprocesses. It calls the async pipelines
in-process via scripts.pipeline.{playwright_page, run_jobs}.

Each render returns a RenderReport that the UI uses to show per-file status.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class RenderItem:
    category: str           # "brand-logos" | "brand-social" | "brand-favicons" | "meta-ads" | "instagram"
    relative_path: str      # path under category root (e.g. "logos/vibeweb-icon.png")
    absolute_path: Path     # full disk path
    width: int
    height: int


@dataclass
class RenderResult:
    item: RenderItem
    status: str             # "ok" | "missing" | "error"
    bytes: int = 0
    error: str | None = None


@dataclass
class RenderReport:
    category: str           # "brand-pack" | "meta-ads" | "instagram" | "all"
    started_at: str
    finished_at: str
    duration_ms: int
    results: list[RenderResult] = field(default_factory=list)

    @property
    def ok_count(self) -> int:
        return sum(1 for r in self.results if r.status == "ok")

    @property
    def total(self) -> int:
        return len(self.results)


# ---- manifest ---------------------------------------------------------------

def _brand_logo_items() -> list[RenderItem]:
    base = ROOT / "brand"
    return [
        RenderItem("brand-logos", "logos/vibeweb-primary.png", base / "logos/vibeweb-primary.png", 800, 200),
        RenderItem("brand-logos", "logos/vibeweb-icon.png",    base / "logos/vibeweb-icon.png",    512, 512),
    ]


_HIGHLIGHT_TYPES = ("portfolio", "services", "about", "contact", "feed")


def _brand_social_items() -> list[RenderItem]:
    base = ROOT / "brand" / "social" / "renders"
    items = [
        RenderItem("brand-social", "social/renders/instagram-post.png",  base / "instagram-post.png",  1080, 1080),
        RenderItem("brand-social", "social/renders/instagram-story.png", base / "instagram-story.png", 1080, 1920),
    ]
    for t in _HIGHLIGHT_TYPES:
        items.append(RenderItem(
            "brand-social",
            f"social/renders/instagram-highlight-{t}.png",
            base / f"instagram-highlight-{t}.png",
            1000, 1000,
        ))
    items.extend([
        RenderItem("brand-social", "social/renders/linkedin-banner.png", base / "linkedin-banner.png", 1584, 396),
        RenderItem("brand-social", "social/renders/og-image.png",        base / "og-image.png",        1200, 630),
    ])
    return items


def _brand_favicon_items() -> list[RenderItem]:
    base = ROOT / "brand" / "favicons"
    return [
        RenderItem("brand-favicons", "favicons/icon-512.png",        base / "icon-512.png",         512, 512),
        RenderItem("brand-favicons", "favicons/favicon-16.png",      base / "favicon-16.png",        16,  16),
        RenderItem("brand-favicons", "favicons/favicon-32.png",      base / "favicon-32.png",        32,  32),
        RenderItem("brand-favicons", "favicons/apple-touch-icon.png", base / "apple-touch-icon.png", 180, 180),
    ]


def _meta_ads_items() -> list[RenderItem]:
    from ads.render import build_jobs as _build
    items = []
    for job in _build():
        items.append(RenderItem(
            "meta-ads",
            job.out.name,
            job.out,
            job.width,
            job.height,
        ))
    return items


def _instagram_items() -> list[RenderItem]:
    from features.instagram_content.jobs import build_jobs as _build
    items = []
    for job in _build():
        items.append(RenderItem(
            "instagram",
            job.out.name,
            job.out,
            job.width,
            job.height,
        ))
    return items


def manifest() -> dict[str, list[RenderItem]]:
    """Enumerate every PNG the pipeline can produce, grouped by category."""
    return {
        "brand-logos":    _brand_logo_items(),
        "brand-social":   _brand_social_items(),
        "brand-favicons": _brand_favicon_items(),
        "meta-ads":       _meta_ads_items(),
        "instagram":      _instagram_items(),
    }
```

- [ ] **Step 4: Run tests — must PASS**

`pytest features/web_gui/services/test_render_service.py -v`
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add features/web_gui/services/render_service.py features/web_gui/services/test_render_service.py
git commit -m "feat(web_gui/services): RenderItem/RenderReport types + manifest enumeration"
```

---

## Task 2: render_meta_ads + render_instagram (use existing run_jobs)

**Files:**
- Modify: `features/web_gui/services/render_service.py`
- Modify: `features/web_gui/services/test_render_service.py`

- [ ] **Step 1: RED — failing test for filtering and report shape**

```python
# Append to test_render_service.py
import pytest
from unittest.mock import patch

@pytest.mark.asyncio
async def test_render_meta_ads_filters_by_ad_id(tmp_path, monkeypatch):
    # Mock run_jobs so we don't actually launch playwright
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
    async def _noop(jobs): pass
    monkeypatch.setattr(render_service, "run_jobs", _noop)
    with pytest.raises(LookupError, match="ad_id"):
        await render_service.render_meta_ads(ad_id="99")


@pytest.mark.asyncio
async def test_render_instagram_filters_by_stem(tmp_path, monkeypatch):
    captured: list = []
    async def _fake_run_jobs(jobs):
        captured.extend(jobs)
        for j in jobs:
            j.out.parent.mkdir(parents=True, exist_ok=True)
            j.out.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 8)

    monkeypatch.setattr(render_service, "run_jobs", _fake_run_jobs)
    report = await render_service.render_instagram(stem="single-manifesto")
    # only one matching job (the manifesto single)
    assert report.total == 1
    assert all("manifesto" in r.item.relative_path for r in report.results)
```

Tests need pytest-asyncio. Verify it's already in `pyproject.toml`:

```bash
grep -E "pytest-asyncio|asyncio_mode" pyproject.toml
```

If missing: add `pytest-asyncio` dep, set `asyncio_mode = "auto"` in `[tool.pytest.ini_options]`.

- [ ] **Step 2: Run — must FAIL**

`pytest features/web_gui/services/test_render_service.py -v -k "render_meta_ads or render_instagram"`
Expected: AttributeError on render_meta_ads / render_instagram.

- [ ] **Step 3: GREEN — implement**

Append to `render_service.py`:

```python
import datetime as _dt
from scripts.pipeline import run_jobs


def _verify_results(items: list[RenderItem]) -> list[RenderResult]:
    results = []
    for it in items:
        if not it.absolute_path.exists():
            results.append(RenderResult(it, "missing"))
            continue
        size = it.absolute_path.stat().st_size
        if size <= 0:
            results.append(RenderResult(it, "missing", bytes=0))
        else:
            results.append(RenderResult(it, "ok", bytes=size))
    return results


def _now_iso() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


async def render_meta_ads(ad_id: str | None = None) -> RenderReport:
    from ads.render import build_jobs as _build_ads
    started = _now_iso()
    t0 = time.monotonic()
    jobs = _build_ads()
    if ad_id is not None:
        filtered = [j for j in jobs if j.out.name.startswith(f"{ad_id}-")]
        if not filtered:
            raise LookupError(f"unknown ad_id {ad_id!r}; available: {[j.out.name for j in jobs]}")
        jobs = filtered
    await run_jobs(jobs)
    items = [RenderItem("meta-ads", j.out.name, j.out, j.width, j.height) for j in jobs]
    results = _verify_results(items)
    return RenderReport(
        category="meta-ads",
        started_at=started,
        finished_at=_now_iso(),
        duration_ms=int((time.monotonic() - t0) * 1000),
        results=results,
    )


async def render_instagram(stem: str | None = None) -> RenderReport:
    from features.instagram_content.jobs import build_jobs as _build_ig
    started = _now_iso()
    t0 = time.monotonic()
    jobs = _build_ig()
    if stem is not None:
        filtered = [j for j in jobs if j.out.name.startswith(stem)]
        if not filtered:
            raise LookupError(f"unknown stem {stem!r}; no instagram job matches")
        jobs = filtered
    await run_jobs(jobs)
    items = [RenderItem("instagram", j.out.name, j.out, j.width, j.height) for j in jobs]
    results = _verify_results(items)
    return RenderReport(
        category="instagram",
        started_at=started,
        finished_at=_now_iso(),
        duration_ms=int((time.monotonic() - t0) * 1000),
        results=results,
    )
```

- [ ] **Step 4: Run — must PASS**

`pytest features/web_gui/services/test_render_service.py -v`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add features/web_gui/services/render_service.py features/web_gui/services/test_render_service.py
git commit -m "feat(web_gui/services): render_meta_ads and render_instagram with filtering"
```

---

## Task 3: render_brand_pack (delegates to scripts.generate.main)

**Files:** Modify `render_service.py` + tests.

- [ ] **Step 1: RED — failing test**

```python
@pytest.mark.asyncio
async def test_render_brand_pack_returns_full_manifest(monkeypatch):
    # Stub scripts.generate.main so playwright doesn't fire
    async def _fake_main():
        # write minimal stubs for every expected brand file
        for cat in ("brand-logos", "brand-social", "brand-favicons"):
            for it in render_service.manifest()[cat]:
                it.absolute_path.parent.mkdir(parents=True, exist_ok=True)
                it.absolute_path.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 8)

    monkeypatch.setattr(render_service, "_brand_main", _fake_main)
    report = await render_service.render_brand_pack()
    assert report.category == "brand-pack"
    assert report.total == 2 + 9 + 4  # 15 brand items
    assert report.ok_count == report.total
```

- [ ] **Step 2: Run — FAIL**

`pytest features/web_gui/services/test_render_service.py::test_render_brand_pack_returns_full_manifest -v`
Expected: AttributeError on `render_brand_pack` or `_brand_main`.

- [ ] **Step 3: GREEN — implement**

Append to `render_service.py`:

```python
async def _brand_main():
    """Indirection so tests can monkeypatch without touching scripts.generate."""
    from scripts.generate import main as _m
    await _m()


async def render_brand_pack() -> RenderReport:
    started = _now_iso()
    t0 = time.monotonic()
    # scripts.generate.main calls sys.exit(1) on partial failure — catch it.
    try:
        await _brand_main()
    except SystemExit as exc:
        # Treat as soft failure — the verify pass below will report missing files.
        if exc.code:
            pass
    items: list[RenderItem] = []
    m = manifest()
    for cat in ("brand-logos", "brand-social", "brand-favicons"):
        items.extend(m[cat])
    results = _verify_results(items)
    return RenderReport(
        category="brand-pack",
        started_at=started,
        finished_at=_now_iso(),
        duration_ms=int((time.monotonic() - t0) * 1000),
        results=results,
    )
```

- [ ] **Step 4: Run — PASS**

`pytest features/web_gui/services/test_render_service.py -v`

- [ ] **Step 5: Commit**

```bash
git add features/web_gui/services/render_service.py features/web_gui/services/test_render_service.py
git commit -m "feat(web_gui/services): render_brand_pack via scripts.generate.main delegation"
```

---

## Task 4: render_all aggregator

**Files:** Modify `render_service.py` + tests.

- [ ] **Step 1: RED**

```python
@pytest.mark.asyncio
async def test_render_all_aggregates_all_categories(monkeypatch):
    async def _fake_brand():
        for cat in ("brand-logos", "brand-social", "brand-favicons"):
            for it in render_service.manifest()[cat]:
                it.absolute_path.parent.mkdir(parents=True, exist_ok=True)
                it.absolute_path.write_bytes(b"PNGSTUB")

    async def _fake_run_jobs(jobs):
        for j in jobs:
            j.out.parent.mkdir(parents=True, exist_ok=True)
            j.out.write_bytes(b"PNGSTUB")

    monkeypatch.setattr(render_service, "_brand_main", _fake_brand)
    monkeypatch.setattr(render_service, "run_jobs", _fake_run_jobs)
    report = await render_service.render_all()
    assert report.category == "all"
    assert report.total == 15 + 6 + 48  # 69 expected
    assert report.ok_count == report.total
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: GREEN**

```python
async def render_all() -> RenderReport:
    started = _now_iso()
    t0 = time.monotonic()
    brand = await render_brand_pack()
    ads = await render_meta_ads()
    ig = await render_instagram()
    return RenderReport(
        category="all",
        started_at=started,
        finished_at=_now_iso(),
        duration_ms=int((time.monotonic() - t0) * 1000),
        results=brand.results + ads.results + ig.results,
    )
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(web_gui/services): render_all aggregates brand+ads+instagram"
```

---

## Task 5: API routes (manifest GET + 4 POST)

**Files:**
- Create: `features/web_gui/api/render.py`
- Create: `features/web_gui/api/test_render.py`
- Modify: `features/web_gui/server.py` (register router)

- [ ] **Step 1: RED**

```python
# features/web_gui/api/test_render.py
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
    # totals
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


def test_post_render_ads_with_filter(client, monkeypatch):
    captured = {"ad_id": None}

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
    captured = {"stem": None}

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
```

- [ ] **Step 2: Run — must FAIL**

`pytest features/web_gui/api/test_render.py -v`
Expected: 404 on every route (router not registered).

- [ ] **Step 3: GREEN — implement router**

```python
# features/web_gui/api/render.py
"""Render routes — trigger the asset pipelines and inspect their manifest.

GET  /api/v1/render/manifest
POST /api/v1/render/brand
POST /api/v1/render/ads          ?ad_id=<id>
POST /api/v1/render/instagram    ?stem=<stem>
POST /api/v1/render/all
"""
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Query

from features.web_gui.services import render_service

router = APIRouter(prefix="/render", tags=["render"])


_CATEGORY_TO_URL_PREFIX = {
    "brand-logos":    "/brand/",
    "brand-social":   "/brand/",
    "brand-favicons": "/brand/",
    "meta-ads":       "/renders/",
    "instagram":      "/instagram/",
}


def _item_to_dict(it: render_service.RenderItem) -> dict:
    prefix = _CATEGORY_TO_URL_PREFIX[it.category]
    return {
        "relative_path": it.relative_path,
        "url": f"{prefix}{it.relative_path}",
        "width": it.width,
        "height": it.height,
        "exists": it.absolute_path.exists() and it.absolute_path.stat().st_size > 0,
    }


def _report_to_dict(report: render_service.RenderReport) -> dict:
    return {
        "category": report.category,
        "started_at": report.started_at,
        "finished_at": report.finished_at,
        "duration_ms": report.duration_ms,
        "ok_count": report.ok_count,
        "total": report.total,
        "results": [
            {
                "category": r.item.category,
                "relative_path": r.item.relative_path,
                "status": r.status,
                "bytes": r.bytes,
                "error": r.error,
            }
            for r in report.results
        ],
    }


@router.get("/manifest")
def get_manifest() -> dict:
    m = render_service.manifest()
    return {"categories": {cat: [_item_to_dict(it) for it in items] for cat, items in m.items()}}


@router.post("/brand")
async def post_render_brand() -> dict:
    report = await render_service.render_brand_pack()
    return _report_to_dict(report)


@router.post("/ads")
async def post_render_ads(ad_id: str | None = Query(default=None, min_length=1)) -> dict:
    try:
        report = await render_service.render_meta_ads(ad_id=ad_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc), "code": "NOT_FOUND"}) from exc
    return _report_to_dict(report)


@router.post("/instagram")
async def post_render_instagram(stem: str | None = Query(default=None, min_length=1)) -> dict:
    try:
        report = await render_service.render_instagram(stem=stem)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc), "code": "NOT_FOUND"}) from exc
    return _report_to_dict(report)


@router.post("/all")
async def post_render_all() -> dict:
    report = await render_service.render_all()
    return _report_to_dict(report)
```

Modify `server.py` — add the import and include_router:

```python
# In features/web_gui/server.py imports:
from features.web_gui.api import assets, brand_files, briefs, creatives, generate, projects, render, traces, variants
# In create_app():
app.include_router(render.router, prefix="/api/v1")
```

- [ ] **Step 4: Run — PASS**

`pytest features/web_gui/api/test_render.py -v`
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add features/web_gui/api/render.py features/web_gui/api/test_render.py features/web_gui/server.py
git commit -m "feat(web_gui/api): /render routes — manifest + trigger brand/ads/instagram/all"
```

---

## Task 6: /instagram static mount

**Files:**
- Modify: `features/web_gui/settings.py` — add `instagram_renders_dir()`
- Modify: `features/web_gui/server.py` — mount it
- Modify: `features/web_gui/test_server.py` — assert mount

- [ ] **Step 1: RED**

Append to `test_server.py`:

```python
def test_instagram_mount_serves_renders(tmp_path, monkeypatch):
    projects = tmp_path / "projects.yaml"
    ads = tmp_path / "ads.yaml"
    projects.write_text(yaml.safe_dump({"projects": {}}))
    ads.write_text(yaml.safe_dump({"ads": {}}))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))

    ig = tmp_path / "ig_renders"
    ig.mkdir()
    (ig / "test.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    monkeypatch.setattr(
        "features.web_gui.server.instagram_renders_dir", lambda: ig,
    )
    from fastapi.testclient import TestClient
    c = TestClient(create_app())
    r = c.get("/instagram/test.png")
    assert r.status_code == 200
    assert r.content.startswith(b"\x89PNG")
```

- [ ] **Step 2: Run — FAIL** (404)

- [ ] **Step 3: GREEN**

In `settings.py`:

```python
def instagram_renders_dir() -> Path:
    return ROOT / "features" / "instagram_content" / "renders"
```

In `server.py` imports:

```python
from features.web_gui.settings import brand_dir, instagram_renders_dir, renders_dir, static_dir, traces_dir, uploads_dir
```

Inside `create_app()`, after the `/renders` mount:

```python
ig_dir = instagram_renders_dir()
if ig_dir.exists():
    app.mount("/instagram", StaticFiles(directory=str(ig_dir)), name="instagram")
else:
    _log.warning("Instagram renders dir %s not found — /instagram will not be served", ig_dir)
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(web_gui): mount /instagram static for instagram_content renders"
```

---

## Task 7: api.ts client methods

**Files:**
- Modify: `features/web_gui/ui/src/types.ts`
- Modify: `features/web_gui/ui/src/api.ts`
- Modify: `features/web_gui/ui/src/api.test.ts`

- [ ] **Step 1: RED — failing vitest**

Add to `api.test.ts`:

```ts
import { api } from './api';

describe('render API', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        categories: { 'brand-logos': [], 'brand-social': [], 'brand-favicons': [], 'meta-ads': [], 'instagram': [] },
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('getRenderManifest hits /render/manifest', async () => {
    await api.getRenderManifest();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/render/manifest', expect.objectContaining({}),
    );
  });

  it('renderBrand POSTs /render/brand', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ category: 'brand-pack', ok_count: 0, total: 0, results: [] }),
        { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    await api.renderBrand();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/render/brand',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('renderAds passes ad_id query param', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ category: 'meta-ads', ok_count: 0, total: 0, results: [] }),
        { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    await api.renderAds('01');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/render/ads?ad_id=01',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('renderInstagram passes stem query param', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ category: 'instagram', ok_count: 0, total: 0, results: [] }),
        { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    await api.renderInstagram('single-manifesto');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/render/instagram?stem=single-manifesto',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
```

- [ ] **Step 2: Run — FAIL**

`cd features/web_gui/ui && npx vitest run src/api.test.ts`
Expected: undefined api.getRenderManifest etc.

- [ ] **Step 3: GREEN**

In `types.ts`:

```ts
export interface RenderManifestItem {
  relative_path: string;
  url: string;
  width: number;
  height: number;
  exists: boolean;
}
export interface RenderManifest {
  categories: Record<string, RenderManifestItem[]>;
}
export interface RenderResultItem {
  category: string;
  relative_path: string;
  status: 'ok' | 'missing' | 'error';
  bytes: number;
  error: string | null;
}
export interface RenderReport {
  category: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  ok_count: number;
  total: number;
  results: RenderResultItem[];
}
```

In `api.ts`, add methods to the `api` object:

```ts
getRenderManifest: () => req<RenderManifest>('/render/manifest'),
renderBrand: () => req<RenderReport>('/render/brand', { method: 'POST' }),
renderAds: (adId?: string) =>
  req<RenderReport>(`/render/ads${adId ? `?ad_id=${adId}` : ''}`, { method: 'POST' }),
renderInstagram: (stem?: string) =>
  req<RenderReport>(`/render/instagram${stem ? `?stem=${stem}` : ''}`, { method: 'POST' }),
renderAll: () => req<RenderReport>('/render/all', { method: 'POST' }),
```

(Add the imports for `RenderManifest`, `RenderReport` at the top of `api.ts`.)

- [ ] **Step 4: Run — PASS**

`cd features/web_gui/ui && npx vitest run src/api.test.ts`

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(web_gui/ui): api client methods for /render routes + types"
```

---

## Task 8: Sidebar nav + ⌘4 keybinding

**Files:**
- Modify: `features/web_gui/ui/src/components/Sidebar.tsx` (add 'studio' to NavSection union, add nav entry)
- Modify: `features/web_gui/ui/src/components/Sidebar.test.tsx`
- Modify: `features/web_gui/ui/src/App.tsx` (handle 'studio' nav + ⌘4)
- Modify: `features/web_gui/ui/src/App.test.tsx`
- Modify: `features/web_gui/ui/src/components/icons.tsx` if a Studio icon is needed (or reuse existing IconCanvas/IconSparkle)

- [ ] **Step 1: RED — Sidebar test for 'Studio' entry**

Add to `Sidebar.test.tsx` (find the test file and append):

```tsx
it('renders the Studio nav item with shortcut 4', () => {
  render(<Sidebar active="flow" onNav={() => {}}
    projects={[{ slug: 'vibeweb', name: 'Vibe Web', description: '', ad_count: 6, created_at: '2026-04-29' }]}
    activeProjectSlug="vibeweb" onSelectProject={() => {}} />);
  expect(screen.getByText(/studio/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — FAIL**

`cd features/web_gui/ui && npx vitest run src/components/Sidebar.test.tsx`

- [ ] **Step 3: GREEN — Sidebar.tsx**

```ts
export type NavSection = 'flow' | 'gallery' | 'brand' | 'studio';
```

Add to the `sections` array in `Sidebar`:

```ts
{ id: 'studio' as const, label: 'Studio', icon: IconCanvas, shortcut: '4' },
```

(`IconCanvas` already exists in `icons.tsx`.)

- [ ] **Step 4: Run Sidebar test — PASS**

- [ ] **Step 5: RED — App.tsx ⌘4 binding**

Add to `App.test.tsx`:

```tsx
it('Cmd+4 routes to studio', async () => {
  // existing render setup
  fireEvent.keyDown(window, { key: '4', metaKey: true });
  expect(await screen.findByTestId('studio-view')).toBeInTheDocument();
});
```

- [ ] **Step 6: Run — FAIL**

- [ ] **Step 7: GREEN — App.tsx**

In the keydown handler add:

```ts
if (mod && e.key === '4') { e.preventDefault(); setNav('studio'); }
```

In the render:

```tsx
{nav === 'studio' && <Studio projectSlug={activeProject}/>}
```

(Studio component lands in next task — for now stub `data-testid="studio-view"`.)

- [ ] **Step 8: Run — PASS**

- [ ] **Step 9: Commit**

```bash
git commit -am "feat(web_gui/ui): Studio nav entry + ⌘4 keyboard shortcut"
```

---

## Task 9: Studio component

**Files:**
- Create: `features/web_gui/ui/src/components/Studio.tsx`
- Create: `features/web_gui/ui/src/components/Studio.test.tsx`

- [ ] **Step 1: RED — Studio test**

```tsx
// Studio.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Studio } from './Studio';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    getRenderManifest: vi.fn().mockResolvedValue({
      categories: {
        'brand-logos': [{ relative_path: 'logos/vibeweb-icon.png', url: '/brand/logos/vibeweb-icon.png', width: 512, height: 512, exists: true }],
        'brand-social': [],
        'brand-favicons': [],
        'meta-ads': [{ relative_path: '01-portfolio-grid.png', url: '/renders/01-portfolio-grid.png', width: 1080, height: 1080, exists: false }],
        'instagram': [{ relative_path: 'single-manifesto.png', url: '/instagram/single-manifesto.png', width: 1080, height: 1350, exists: false }],
      },
    }),
    renderBrand: vi.fn().mockResolvedValue({ category: 'brand-pack', ok_count: 1, total: 1, results: [] }),
    renderAds: vi.fn(),
    renderInstagram: vi.fn(),
    renderAll: vi.fn(),
  },
}));

describe('Studio', () => {
  it('renders three category sections', async () => {
    render(<Studio projectSlug="vibeweb"/>);
    await waitFor(() => expect(screen.getByText(/Brand/i)).toBeInTheDocument());
    expect(screen.getByText(/Meta Ads/i)).toBeInTheDocument();
    expect(screen.getByText(/Instagram/i)).toBeInTheDocument();
  });

  it('shows pending state for assets that do not exist on disk', async () => {
    render(<Studio projectSlug="vibeweb"/>);
    await waitFor(() => expect(screen.getAllByTestId('asset-card')).toHaveLength(3));
    const pending = screen.getAllByText(/pendente/i);
    expect(pending.length).toBeGreaterThanOrEqual(2);  // ads + ig
  });

  it('clicking Generate Brand calls api.renderBrand and refreshes', async () => {
    render(<Studio projectSlug="vibeweb"/>);
    await waitFor(() => screen.getByText(/Gerar marca/i));
    fireEvent.click(screen.getByText(/Gerar marca/i));
    await waitFor(() => expect(api.renderBrand).toHaveBeenCalled());
    // Manifest is refetched after render — listProjects-style pattern
    await waitFor(() => expect(api.getRenderManifest).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: GREEN — Studio.tsx**

```tsx
// Studio.tsx
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { RenderManifest, RenderManifestItem } from '../types';

interface StudioProps {
  projectSlug: string;
}

type GenerateState = { kind: 'idle' } | { kind: 'running'; category: string } | { kind: 'error'; message: string };

const SECTIONS: Array<{ key: string; label: string; categories: string[]; action: 'brand' | 'ads' | 'instagram' }> = [
  { key: 'brand',     label: 'Marca',     categories: ['brand-logos', 'brand-social', 'brand-favicons'], action: 'brand' },
  { key: 'meta-ads',  label: 'Meta Ads',  categories: ['meta-ads'],                                       action: 'ads' },
  { key: 'instagram', label: 'Instagram', categories: ['instagram'],                                      action: 'instagram' },
];

export function Studio({ projectSlug }: StudioProps) {
  const [manifest, setManifest] = useState<RenderManifest | null>(null);
  const [state, setState] = useState<GenerateState>({ kind: 'idle' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api.getRenderManifest()
      .then(setManifest)
      .catch((e: Error) => setState({ kind: 'error', message: e.message }));
  }, [reloadKey]);

  async function generate(action: 'brand' | 'ads' | 'instagram') {
    setState({ kind: 'running', category: action });
    try {
      if (action === 'brand') await api.renderBrand();
      else if (action === 'ads') await api.renderAds();
      else await api.renderInstagram();
      setReloadKey(k => k + 1);
      setState({ kind: 'idle' });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div data-testid="studio-view"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fafaf9', overflow: 'auto' }}>
      <header style={{
        height: 56, flexShrink: 0, background: '#fff',
        borderBottom: '1px solid #e7e5e4',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16,
      }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1c1917', letterSpacing: -0.1 }}>
          Studio
        </h1>
        <span style={{
          fontFamily: '"Geist Mono", monospace', fontSize: 10,
          padding: '2px 6px', borderRadius: 4,
          background: '#f5f5f4', color: '#78716c',
        }}>{projectSlug}</span>
      </header>

      {state.kind === 'error' && (
        <div role="alert" style={{
          padding: '8px 20px', fontSize: 12, color: '#dc2626',
          background: 'rgba(220, 38, 38, 0.10)',
          borderBottom: '1px solid rgba(220, 38, 38, 0.2)',
          fontFamily: '"Geist Mono", monospace',
        }}>erro: {state.message}</div>
      )}

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>
        {SECTIONS.map(sec => {
          const items: RenderManifestItem[] = sec.categories.flatMap(c => manifest?.categories[c] ?? []);
          const okCount = items.filter(it => it.exists).length;
          const running = state.kind === 'running' && state.category === sec.action;
          return (
            <section key={sec.key}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#1c1917' }}>{sec.label}</h2>
                <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 11, color: '#6f6a64' }}>
                  {okCount}/{items.length}
                </span>
                <div style={{ flex: 1 }}/>
                <button
                  onClick={() => void generate(sec.action)}
                  disabled={running}
                  style={{
                    padding: '6px 12px', borderRadius: 6,
                    background: running ? '#e7e5e4' : '#1c1917',
                    color: running ? '#78716c' : '#fafaf9',
                    border: 'none', cursor: running ? 'default' : 'pointer',
                    fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                  }}
                >
                  {running ? 'Renderizando…' : sec.key === 'brand' ? 'Gerar marca' : sec.key === 'meta-ads' ? 'Gerar ads' : 'Gerar instagram'}
                </button>
              </div>
              <div style={{
                display: 'grid', gap: 10,
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              }}>
                {items.map(it => (
                  <AssetCard key={it.relative_path} item={it}/>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function AssetCard({ item }: { item: RenderManifestItem }) {
  return (
    <div data-testid="asset-card" style={{
      background: '#fff', border: '1px solid #e7e5e4', borderRadius: 8, overflow: 'hidden',
    }}>
      <div style={{
        aspectRatio: `${item.width}/${item.height}`,
        background: item.exists ? '#0a0a0a' : 'repeating-linear-gradient(45deg, #fafaf9, #fafaf9 8px, #f5f5f4 8px, #f5f5f4 16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {item.exists ? (
          <img
            src={`${item.url}?v=${Date.now()}`}
            alt={item.relative_path}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <span style={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: 10, color: '#78716c',
            textTransform: 'uppercase', letterSpacing: 0.6,
          }}>pendente</span>
        )}
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: 11, color: '#1c1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.relative_path}
        </div>
        <div style={{ fontSize: 10, color: '#6f6a64', fontFamily: '"Geist Mono", monospace', marginTop: 1 }}>
          {item.width}×{item.height}
        </div>
      </div>
    </div>
  );
}
```

Update `App.tsx` to import and render `Studio` instead of the stub.

- [ ] **Step 4: Run — PASS**

`cd features/web_gui/ui && npx vitest run src/components/Studio.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add features/web_gui/ui/src/components/Studio.tsx features/web_gui/ui/src/components/Studio.test.tsx features/web_gui/ui/src/App.tsx
git commit -m "feat(web_gui/ui): Studio view — manifest grid + Generate buttons per category"
```

---

## Task 10: Build the Vite bundle (so production server-of-static works)

- [ ] **Step 1:** `cd features/web_gui/ui && npm run build`

The build writes to `features/web_gui/static/` so FastAPI's `/ui` mount picks it up.

- [ ] **Step 2:** Run full pytest

```bash
pytest -q
```

Expected: all green.

- [ ] **Step 3:** Run vitest

```bash
cd features/web_gui/ui && npx vitest run
```

- [ ] **Step 4:** Commit the build bundle? **No** — `static/` is gitignored.

---

## Final Verification

- [ ] `pytest -q` — all tests green
- [ ] `cd features/web_gui/ui && npx vitest run` — vitest green
- [ ] Manual smoke (optional): start `python scripts/dev.py`, open `http://localhost:5173/ui/`, click Studio (⌘4), click "Gerar marca" — verify it rerenders the brand pack and the cards flip from "pendente" to thumbnails.
- [ ] `pr-review-toolkit:review-pr` — Review Gate

---

## Task 11: Dockerfile — install Playwright chromium browser

**Why:** today the Dockerfile pip-installs `playwright>=1.47` but never runs
`playwright install`, so the container has the Python SDK without the chromium
binary. Any render call would crash with `Executable doesn't exist`. With this
task, the deployed VPS gains parity with local renders — fulfilling the
"VPS = ops center" requirement.

**Files:** Modify `Dockerfile`.

- [ ] **Step 1: Modify the Python deps layer**

After the `pip install` block (line 23-31 currently), add:

```dockerfile
# Playwright chromium binary + system deps (libnss, libatk, libcups, etc).
# Without this the python SDK is present but render calls crash with
# "Executable doesn't exist". --with-deps installs apt packages chromium needs.
RUN python -m playwright install --with-deps chromium
```

- [ ] **Step 2: Verify build works**

```bash
docker build -t vibeweb-test .
```

Expected: completes without error. (If `--with-deps` fails on the slim image,
fall back to `apt-get install` of the packages manually — Playwright's docs
list them.)

- [ ] **Step 3: Smoke test the container can render**

```bash
docker run --rm -e VIBEWEB_DRY_RUN=1 vibeweb-test \
    python -c "import asyncio; from scripts.pipeline import playwright_page; \
async def m(): \
    async with playwright_page() as p: print('ok'); \
asyncio.run(m())"
```

Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile
git commit -m "deploy: install Playwright chromium browser in container — enable VPS render"
```

---

## Task 12: docker-compose — persist generated outputs as volumes

**Why:** today the compose file mounts only `config/`, `traces/`, `uploads/`
as bind volumes. When the web app generates PNGs into
`brand/social/renders/`, `ads/renders/`, `features/instagram_content/renders/`,
those writes happen inside the container's overlay filesystem and are lost
the next time `bash deploy/install.sh` rebuilds the image. With this task the
outputs become first-class data — the VPS becomes the source of truth for
generated assets.

**Files:** Modify `docker-compose.yml`.

- [ ] **Step 1: RED — write the missing-volumes test**

```python
# Append to features/web_gui/test_server.py — but this is really a deploy test.
# Put it under deploy/test_compose.py:

# deploy/test_compose.py
from pathlib import Path
import yaml


def test_compose_persists_render_outputs():
    """The web app's render service writes to these dirs; without volumes
    the outputs are lost on every redeploy."""
    cf = Path(__file__).resolve().parent.parent / "docker-compose.yml"
    data = yaml.safe_load(cf.read_text(encoding="utf-8"))
    volumes = data["services"]["criativos"]["volumes"]
    expected = {
        "./brand/social/renders:/app/brand/social/renders",
        "./brand/favicons:/app/brand/favicons",
        "./ads/renders:/app/ads/renders",
        "./features/instagram_content/renders:/app/features/instagram_content/renders",
    }
    missing = expected - set(volumes)
    assert not missing, f"missing render-output volumes: {missing}"
```

- [ ] **Step 2: Run — must FAIL**

`pytest deploy/test_compose.py -v`
Expected: AssertionError listing the four missing volumes.

- [ ] **Step 3: GREEN — add the volumes**

```yaml
# docker-compose.yml
services:
  criativos:
    build: .
    container_name: criativos
    restart: unless-stopped
    ports:
      - "127.0.0.1:8090:8000"
    volumes:
      - ./config:/app/config
      - ./features/web_gui/traces:/app/features/web_gui/traces
      - ./features/web_gui/uploads:/app/features/web_gui/uploads
      # Render outputs — without these, web-app-generated PNGs vanish on rebuild.
      # Brand logos (vibeweb-*.png) live alongside .svg sources, so we mount
      # only the generated subdirs (renders/, favicons/), not the whole brand/.
      - ./brand/social/renders:/app/brand/social/renders
      - ./brand/favicons:/app/brand/favicons
      - ./ads/renders:/app/ads/renders
      - ./features/instagram_content/renders:/app/features/instagram_content/renders
    env_file:
      - .env
    environment:
      - PYTHONUNBUFFERED=1
```

- [ ] **Step 4: Run — PASS**

`pytest deploy/test_compose.py -v`

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml deploy/test_compose.py
git commit -m "deploy: persist render outputs (brand/social, brand/favicons, ads/renders, IG renders) as docker volumes"
```

---

## Task 13: deploy/README.md — document REST as agent-callable ops surface

**Why:** the user wants the web app to be the ops center for any agent
(Claude Code, n8n, curl). Document the REST surface explicitly so it's
obvious what the entry-points are.

**Files:** Modify `deploy/README.md`.

- [ ] **Step 1:** Append a section to `deploy/README.md`:

````markdown
## Ops-center REST surface (call from any agent)

The deployed web app at `https://criativos.vinicius.xyz/` exposes the entire
asset pipeline as REST endpoints. Any agent — Claude Code, a script, n8n —
can trigger renders without being on the local machine.

### Render endpoints

```bash
# Enumerate every PNG the pipeline can produce (brand + ads + instagram).
curl https://criativos.vinicius.xyz/api/v1/render/manifest | jq

# Trigger a render. Sync — returns when done (~6-30 s depending on category).
curl -X POST https://criativos.vinicius.xyz/api/v1/render/brand
curl -X POST 'https://criativos.vinicius.xyz/api/v1/render/ads?ad_id=01'
curl -X POST 'https://criativos.vinicius.xyz/api/v1/render/instagram?stem=single-manifesto'
curl -X POST https://criativos.vinicius.xyz/api/v1/render/all
```

After a successful render the PNGs are immediately served at:
- `/brand/<rel-path>` — brand pack
- `/renders/<file>.png` — Meta Ads
- `/instagram/<file>.png` — Instagram content

### Copy generation

```bash
curl -X POST https://criativos.vinicius.xyz/api/v1/generate \
  -H 'content-type: application/json' \
  -d '{"project_slug":"vibeweb","ad_id":"01","methodology":"pas","n_variants":3,"persist":true}'
```

### Why this matters

Outputs land in docker volumes (`brand/`, `ads/renders/`, `features/instagram_content/renders/`)
and persist across deploys. The git-push-then-rebuild cycle is no longer the
only way to refresh assets — the web app itself is now the operations center.
````

- [ ] **Step 2: Commit**

```bash
git commit -am "docs: deploy/README — REST surface as ops-center entry-point for any agent"
```

---

## Out of scope (deferred)

- **SSE progress streaming** for renders. v1 ships sync POSTs (~30 s for `render_all`). UI shows a spinner.
- **Per-asset re-render** from the Studio grid (only category-level "Generate all" in v1).
- **Editing copy from the UI then regenerating** — `ads.yaml` editing already exists via `briefs` route, but no "regenerate this ad's PNG" button yet. The user can hit `POST /render/ads?ad_id=01` directly. UI button is a v2 follow-up.
- **Carousel/video** — schema supports them; renderer doesn't yet.
- **Auth on the deployed VPS REST**. The render endpoints are currently unauthenticated. If exposed publicly long-term, add a token check in a follow-up. Today the surface lives behind Caddy on a personal-use domain — acceptable risk for v1.
