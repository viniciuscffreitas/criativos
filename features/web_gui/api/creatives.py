"""
Creatives routes — list creative cards (base + variants) for a project.

Routes:
  GET  /projects/{slug}/creatives          optional ?kind= &status= filters

Each ad in ads.yaml yields one base creative plus one entry per variant.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from features.web_gui.api._helpers import resolve_ads_path
from features.web_gui.services import yaml_rw

router = APIRouter(prefix="/projects/{slug}/creatives", tags=["creatives"])


class CreativeOut(BaseModel):
    id: str
    kind: str
    title: str
    placement: str
    format: str
    headline: str
    body: str
    hero: str
    ctas: list[str]
    thumbnail_url: str
    status: str
    ad_id: str
    variant_id: str | None
    last_run_id: str | None


class CreativeListOut(BaseModel):
    creatives: list[CreativeOut]


@router.get("", response_model=CreativeListOut)
def list_creatives(
    slug: str,
    kind: str | None = Query(default=None, min_length=1),
    status: str | None = Query(default=None, min_length=1),
):
    ads_path = resolve_ads_path(slug)
    try:
        data = yaml_rw.read(ads_path)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": f"ads file not found: {ads_path}", "code": "ADS_FILE_NOT_FOUND"},
        ) from exc
    out: list[CreativeOut] = []
    for _, ad in data.get("ads", {}).items():
        base = _ad_to_creative_base(ad)
        if kind is not None and base.kind != kind:
            continue
        if status is not None and base.status != status:
            continue
        out.append(base)
        for v in ad.get("variants", []):
            variant = _variant_to_creative(ad, v)
            if kind is not None and variant.kind != kind:
                continue
            if status is not None and variant.status != status:
                continue
            out.append(variant)
    return CreativeListOut(creatives=out)


def _ad_to_creative_base(ad: dict) -> CreativeOut:
    return CreativeOut(
        id=f"{ad['slug']}-base",
        kind=ad.get("kind", "image"),
        title=ad["slug"].replace("-", " ").title(),
        placement=ad.get("placement", ""),
        format=ad.get("format", ""),
        headline=ad.get("meta", {}).get("headline", ""),
        body=ad.get("meta", {}).get("primary_text", ""),
        hero=ad.get("copy", {}).get("hero", ""),
        ctas=ad.get("brief", {}).get("ctas", []),
        thumbnail_url=f"/renders/{ad['id']}-{ad['slug']}.png",
        status="ready",
        ad_id=ad["id"],
        variant_id=None,
        last_run_id=ad.get("trace", {}).get("last_run"),
    )


def _variant_to_creative(ad: dict, v: dict) -> CreativeOut:
    return CreativeOut(
        id=f"{ad['slug']}-{v['id'].lower()}",
        kind=ad.get("kind", "image"),
        title=f"{ad['slug'].replace('-', ' ').title()} · {v['id']}",
        placement=ad.get("placement", ""),
        format=ad.get("format", ""),
        headline=v.get("headline", ""),
        body=v.get("primary_text", ""),
        hero=ad.get("copy", {}).get("hero", ""),
        ctas=v.get("ctas", []),
        # Variants share the base ad's render in MVP — no per-variant render pipeline yet.
        thumbnail_url=f"/renders/{ad['id']}-{ad['slug']}.png",
        status="ready",
        ad_id=ad["id"],
        variant_id=v["id"],
        last_run_id=ad.get("trace", {}).get("last_run"),
    )
