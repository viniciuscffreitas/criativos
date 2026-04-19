"""
Briefs routes — GET + atomic PUT for ads.<key>.brief in the project's ads.yaml.

Routes:
  GET  /projects/{slug}/ads/{ad_id}/brief
  PUT  /projects/{slug}/ads/{ad_id}/brief

PUT uses yaml_rw.modify() so the full read-mutate-write is held under LOCK_EX.
"""
from __future__ import annotations
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from features.web_gui.services import yaml_rw
from features.web_gui.settings import projects_yaml_path

router = APIRouter(prefix="/projects/{slug}/ads/{ad_id}/brief", tags=["briefs"])


class BriefIn(BaseModel):
    product: str
    audience: str
    pain: str
    ctas: list[str]
    social_proof: str | None = None


class BriefOut(BriefIn):
    pass


def _resolve_ads_path(slug: str) -> Path:
    """Read projects.yaml and resolve the ads_path for this slug (relative to config dir)."""
    projects_path = projects_yaml_path()
    data = yaml_rw.read(projects_path)
    projects = data.get("projects", {})
    if slug not in projects:
        raise HTTPException(
            status_code=404,
            detail={"error": f"project {slug!r} not found", "code": "PROJECT_NOT_FOUND"},
        )
    ads_path = Path(projects[slug]["ads_path"])
    if not ads_path.is_absolute():
        ads_path = projects_path.parent / ads_path
    return ads_path


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
    ads_path = _resolve_ads_path(slug)
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
    ads_path = _resolve_ads_path(slug)

    def mutate(data: dict) -> dict:
        key = _find_ad_key(data, ad_id)
        data["ads"][key]["brief"] = payload.model_dump()
        return data

    yaml_rw.modify(ads_path, mutate)
    return {"updated": True, "brief": payload.model_dump()}
