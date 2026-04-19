from pathlib import Path

import pytest
import yaml

from features.web_gui.services.project_store import ProjectStore


@pytest.fixture
def store(tmp_path: Path) -> ProjectStore:
    projects = tmp_path / "projects.yaml"
    ads = tmp_path / "ads.yaml"
    projects.write_text(yaml.safe_dump({
        "projects": {
            "alpha": {
                "slug": "alpha", "name": "Alpha", "description": "d",
                "ads_path": str(ads), "renders_path": str(tmp_path / "renders"),
                "brand_path": str(tmp_path / "brand"),
                "created_at": "2026-04-18T00:00:00Z",
            }
        }
    }))
    ads.write_text(yaml.safe_dump({"ads": {"01_x": {"id": "01", "slug": "x", "variants": []}}}))
    return ProjectStore(projects_yaml=projects)


def test_list_returns_all_projects(store):
    items = store.list()
    assert len(items) == 1
    assert items[0].slug == "alpha"
    assert items[0].ad_count == 1
    assert items[0].variant_count == 0


def test_get_by_slug_found(store):
    p = store.get("alpha")
    assert p.name == "Alpha"


def test_get_by_slug_missing_raises(store):
    with pytest.raises(KeyError, match="unknown project 'ghost'"):
        store.get("ghost")
