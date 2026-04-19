"""
Reads config/projects.yaml, joins with config/ads.yaml counts.
Verbose entry-point — no ORM, no caching layer.
"""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path

from features.web_gui.services import yaml_rw


@dataclass
class Project:
    slug: str
    name: str
    description: str
    ad_count: int
    variant_count: int
    created_at: str


class ProjectStore:
    def __init__(self, projects_yaml: Path):
        self.path = projects_yaml

    def list(self) -> list[Project]:
        data = yaml_rw.read(self.path)
        out: list[Project] = []
        for slug, entry in data.get("projects", {}).items():
            ads_path = Path(entry["ads_path"])
            ad_count, variant_count = _ad_and_variant_counts(ads_path)
            out.append(Project(
                slug=slug,
                name=entry["name"],
                description=entry.get("description", ""),
                ad_count=ad_count,
                variant_count=variant_count,
                created_at=entry.get("created_at", ""),
            ))
        return out

    def get(self, slug: str) -> Project:
        for p in self.list():
            if p.slug == slug:
                return p
        raise KeyError(f"unknown project {slug!r}")


def _ad_and_variant_counts(ads_path: Path) -> tuple[int, int]:
    if not ads_path.exists():
        return 0, 0
    data = yaml_rw.read(ads_path)
    ads = data.get("ads", {})
    ad_count = len(ads)
    variant_count = sum(len(ad.get("variants", [])) for ad in ads.values())
    return ad_count, variant_count
