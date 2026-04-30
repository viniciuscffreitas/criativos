"""Render service — wraps the existing async pipelines for HTTP-driven invocation.

Public surface:
  - manifest()                         — enumerates every PNG the pipeline can produce
  - async render_brand_pack()          — runs scripts.generate.main()
  - async render_meta_ads(ad_id=None)  — uses ads.render.build_jobs()
  - async render_instagram(stem=None)  — uses features.instagram_content.jobs.build_jobs()
  - async render_all()                 — runs the three above in sequence

The service does NOT spawn subprocesses. It calls the async pipelines
in-process via scripts.pipeline.{playwright_page, run_jobs}, which is what
the CLI entry-points already use.

Each render returns a RenderReport with per-file status that the UI uses to
flip cards from "pendente" to a thumbnail.
"""
from __future__ import annotations

import datetime as _dt
import time
from dataclasses import dataclass, field
from pathlib import Path

from scripts.pipeline import run_jobs

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


# ---------------------------------------------------------------------------
# manifest — enumerate every expected output (no rendering)
# ---------------------------------------------------------------------------

_HIGHLIGHT_TYPES = ("portfolio", "services", "about", "contact", "feed")


def _brand_logo_items() -> list[RenderItem]:
    base = ROOT / "brand"
    return [
        RenderItem("brand-logos", "logos/vibeweb-primary.png", base / "logos" / "vibeweb-primary.png", 800, 200),
        RenderItem("brand-logos", "logos/vibeweb-icon.png",    base / "logos" / "vibeweb-icon.png",    512, 512),
    ]


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
        RenderItem("brand-favicons", "favicons/icon-512.png",         base / "icon-512.png",         512, 512),
        RenderItem("brand-favicons", "favicons/favicon-16.png",       base / "favicon-16.png",        16,  16),
        RenderItem("brand-favicons", "favicons/favicon-32.png",       base / "favicon-32.png",        32,  32),
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


# ---------------------------------------------------------------------------
# Render functions
# ---------------------------------------------------------------------------

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


async def _brand_main():
    """Indirection so tests can monkeypatch without touching scripts.generate."""
    from scripts.generate import main as _m
    await _m()


async def render_brand_pack() -> RenderReport:
    """Render the brand pack (logos + social + favicons) by delegating to
    scripts.generate.main(). That entry-point uses sys.exit(1) on partial
    failure — we catch SystemExit so _verify_results below still runs and
    reports per-file status.
    """
    started = _now_iso()
    t0 = time.monotonic()
    try:
        await _brand_main()
    except SystemExit:
        pass

    items: list[RenderItem] = []
    m = manifest()
    for cat in ("brand-logos", "brand-social", "brand-favicons"):
        items.extend(m[cat])
    return RenderReport(
        category="brand-pack",
        started_at=started,
        finished_at=_now_iso(),
        duration_ms=int((time.monotonic() - t0) * 1000),
        results=_verify_results(items),
    )


async def render_meta_ads(ad_id: str | None = None) -> RenderReport:
    """Render Meta Ads. When ad_id is given, render only that ad (matched by
    the rendered filename's leading id segment, e.g. "01-portfolio-grid.png").
    """
    from ads.render import build_jobs as _build_ads

    started = _now_iso()
    t0 = time.monotonic()
    jobs = _build_ads()
    if ad_id is not None:
        filtered = [j for j in jobs if j.out.name.startswith(f"{ad_id}-")]
        if not filtered:
            available = sorted({j.out.name.split("-", 1)[0] for j in jobs})
            raise LookupError(
                f"unknown ad_id {ad_id!r}; available ids: {available}"
            )
        jobs = filtered
    try:
        await run_jobs(jobs)
    except Exception as e:
        raise RuntimeError(
            f"render_meta_ads(ad_id={ad_id!r}) failed during run_jobs "
            f"(jobs={[j.out.name for j in jobs]})"
        ) from e
    items = [
        RenderItem("meta-ads", j.out.name, j.out, j.width, j.height)
        for j in jobs
    ]
    return RenderReport(
        category="meta-ads",
        started_at=started,
        finished_at=_now_iso(),
        duration_ms=int((time.monotonic() - t0) * 1000),
        results=_verify_results(items),
    )


async def render_instagram(stem: str | None = None) -> RenderReport:
    """Render Instagram content. When stem is given, render only jobs whose
    output filename starts with that stem (e.g. "single-manifesto",
    "carousel-portfolio", "highlight-cover-services").
    """
    from features.instagram_content.jobs import build_jobs as _build_ig

    started = _now_iso()
    t0 = time.monotonic()
    jobs = _build_ig()
    if stem is not None:
        filtered = [j for j in jobs if j.out.name.startswith(stem)]
        if not filtered:
            raise LookupError(
                f"unknown stem {stem!r}; no instagram job matches"
            )
        jobs = filtered
    try:
        await run_jobs(jobs)
    except Exception as e:
        raise RuntimeError(
            f"render_instagram(stem={stem!r}) failed during run_jobs "
            f"({len(jobs)} jobs)"
        ) from e
    items = [
        RenderItem("instagram", j.out.name, j.out, j.width, j.height)
        for j in jobs
    ]
    return RenderReport(
        category="instagram",
        started_at=started,
        finished_at=_now_iso(),
        duration_ms=int((time.monotonic() - t0) * 1000),
        results=_verify_results(items),
    )


async def render_all() -> RenderReport:
    """Run brand + ads + instagram in sequence and aggregate results.

    Sequential by design: each step opens its own playwright browser; running
    them in parallel triples chromium memory usage and hits the 30s default
    request timeout for FastAPI.
    """
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
