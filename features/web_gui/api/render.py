"""Render routes — trigger the asset pipelines and inspect their manifest.

Routes:
  GET  /api/v1/render/manifest                  — enumerate every PNG (no rendering)
  POST /api/v1/render/brand                     — render brand pack (logos+social+favicons)
  POST /api/v1/render/ads          ?ad_id=<id>  — render Meta Ads (one or all)
  POST /api/v1/render/instagram    ?stem=<s>    — render Instagram content (one or all)
  POST /api/v1/render/all                       — brand + ads + instagram in sequence

These routes call render_service through the module reference (not a direct
function import) so tests can monkeypatch render_service.render_brand_pack
etc. without rewiring the route registration.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from features.web_gui.services import render_service

router = APIRouter(prefix="/render", tags=["render"])


# Each category is served by a different StaticFiles mount. Brand assets
# (logos/social/favicons) all sit under brand_dir() at /brand. Meta ads land
# at /renders. Instagram lands at /instagram (mounted in server.py).
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
        "category": it.category,
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
    return {
        "categories": {
            cat: [_item_to_dict(it) for it in items]
            for cat, items in m.items()
        }
    }


@router.post("/brand")
async def post_render_brand() -> dict:
    report = await render_service.render_brand_pack()
    return _report_to_dict(report)


@router.post("/ads")
async def post_render_ads(
    ad_id: str | None = Query(default=None, min_length=1),
) -> dict:
    try:
        report = await render_service.render_meta_ads(ad_id=ad_id)
    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail={"error": str(exc), "code": "NOT_FOUND"},
        ) from exc
    return _report_to_dict(report)


@router.post("/instagram")
async def post_render_instagram(
    stem: str | None = Query(default=None, min_length=1),
) -> dict:
    try:
        report = await render_service.render_instagram(stem=stem)
    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail={"error": str(exc), "code": "NOT_FOUND"},
        ) from exc
    return _report_to_dict(report)


@router.post("/all")
async def post_render_all() -> dict:
    report = await render_service.render_all()
    return _report_to_dict(report)
