"""HTTP-layer helpers shared across api/ routes.

Private module (leading underscore) — not part of the public API surface.
"""
from __future__ import annotations
from pathlib import Path
from typing import Iterator

from fastapi import HTTPException

from features.web_gui.services import yaml_rw
from features.web_gui.settings import projects_yaml_path


def find_ad_key(ads_data: dict, ad_id: str) -> str:
    """Return the YAML key whose ads entry has id == ad_id.

    Raises HTTPException(404, AD_NOT_FOUND) if not found.
    """
    for key, ad in ads_data.get("ads", {}).items():
        if ad.get("id") == ad_id:
            return key
    raise HTTPException(
        status_code=404,
        detail={"error": f"ad {ad_id!r} not found in project", "code": "AD_NOT_FOUND"},
    )


def resolve_ads_path(slug: str) -> Path:
    """Look up `slug` in projects.yaml and return the resolved ads_path.

    Raises HTTPException(404) for unknown slug, HTTPException(500) when the
    project entry is missing the required `ads_path` key. Relative paths are
    resolved against projects.yaml's directory, matching ProjectStore behavior.
    """
    projects_path = projects_yaml_path()
    data = yaml_rw.read(projects_path)
    projects = data.get("projects", {})
    if slug not in projects:
        raise HTTPException(
            status_code=404,
            detail={"error": f"project {slug!r} not found", "code": "PROJECT_NOT_FOUND"},
        )
    entry = projects[slug]
    if "ads_path" not in entry:
        raise HTTPException(
            status_code=500,
            detail={
                "error": f"project {slug!r} has no ads_path configured in projects.yaml",
                "code": "PROJECT_MISCONFIGURED",
            },
        )
    ads_path = Path(entry["ads_path"])
    if not ads_path.is_absolute():
        ads_path = projects_path.parent / ads_path
    return ads_path


def iter_ads_paths() -> Iterator[tuple[str, Path]]:
    """Yield (slug, ads_path) for every project entry in projects.yaml.

    Raises HTTPException(500, PROJECT_MISCONFIGURED) loudly for any entry that
    lacks ads_path — no silent skip, per §2.7.
    """
    projects_path = projects_yaml_path()
    data = yaml_rw.read(projects_path)
    for slug, entry in data.get("projects", {}).items():
        if "ads_path" not in entry:
            raise HTTPException(
                status_code=500,
                detail={
                    "error": f"project {slug!r} has no ads_path configured in projects.yaml",
                    "code": "PROJECT_MISCONFIGURED",
                },
            )
        ads_path = Path(entry["ads_path"])
        if not ads_path.is_absolute():
            ads_path = projects_path.parent / ads_path
        yield slug, ads_path
