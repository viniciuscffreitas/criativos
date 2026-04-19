"""
Briefs routes — GET + atomic PUT for ads.<key>.brief in the project's ads.yaml.

Routes:
  GET  /projects/{slug}/ads/{ad_id}/brief
  PUT  /projects/{slug}/ads/{ad_id}/brief

PUT uses yaml_rw.modify() so the full read-mutate-write is held under LOCK_EX.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from features.web_gui.api._helpers import resolve_ads_path
from features.web_gui.services import yaml_rw

router = APIRouter(prefix="/projects/{slug}/ads/{ad_id}/brief", tags=["briefs"])


class _AdNotFound(Exception):
    """Raised inside a yaml_rw.modify callback when the target ad_id is missing.
    Caller translates to HTTPException 404 — keeps yaml_rw HTTP-agnostic."""


class BriefIn(BaseModel):
    product: str
    audience: str
    pain: str
    ctas: list[str]
    social_proof: str | None = None


class BriefOut(BriefIn):
    pass



def _find_ad_key(ads_data: dict, ad_id: str) -> str:
    for key, ad in ads_data.get("ads", {}).items():
        if ad.get("id") == ad_id:
            return key
    raise HTTPException(
        status_code=404,
        detail={"error": f"ad {ad_id!r} not found in project", "code": "AD_NOT_FOUND"},
    )


@router.get("", response_model=BriefOut)
def get_brief(slug: str, ad_id: str):
    ads_path = resolve_ads_path(slug)
    data = yaml_rw.read(ads_path)
    key = _find_ad_key(data, ad_id)
    brief = data["ads"][key].get("brief")
    if brief is None:
        raise HTTPException(
            status_code=404,
            detail={"error": f"ad {ad_id!r} has no brief", "code": "BRIEF_NOT_FOUND"},
        )
    return BriefOut(
        product=brief["product"],
        audience=brief["audience"],
        pain=brief["pain"],
        ctas=brief["ctas"],
        social_proof=brief.get("social_proof"),
    )


@router.put("")
def put_brief(slug: str, ad_id: str, payload: BriefIn):
    ads_path = resolve_ads_path(slug)

    def mutate(data: dict) -> dict:
        for key, ad in data.get("ads", {}).items():
            if ad.get("id") == ad_id:
                data["ads"][key]["brief"] = payload.model_dump()
                return data
        raise _AdNotFound(ad_id)

    try:
        yaml_rw.modify(ads_path, mutate)
    except _AdNotFound as exc:
        raise HTTPException(
            status_code=404,
            detail={"error": f"ad {str(exc)!r} not found in project", "code": "AD_NOT_FOUND"},
        ) from exc
    return {"updated": True, "brief": payload.model_dump()}
