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


def test_list_raises_when_ads_path_missing(tmp_path: Path):
    projects = tmp_path / "projects.yaml"
    missing_ads = tmp_path / "does_not_exist.yaml"
    projects.write_text(yaml.safe_dump({
        "projects": {
            "alpha": {
                "slug": "alpha", "name": "Alpha", "description": "d",
                "ads_path": str(missing_ads),
                "renders_path": str(tmp_path / "renders"),
                "brand_path": str(tmp_path / "brand"),
                "created_at": "2026-04-18T00:00:00Z",
            }
        }
    }))
    store = ProjectStore(projects_yaml=projects)
    with pytest.raises(FileNotFoundError, match="configured in projects.yaml does not exist"):
        store.list()


def test_list_resolves_relative_ads_path_against_config_dir(tmp_path: Path):
    projects = tmp_path / "projects.yaml"
    ads = tmp_path / "ads.yaml"
    ads.write_text(yaml.safe_dump({"ads": {"01_x": {"id": "01", "slug": "x", "variants": [{"id": "v1"}]}}}))
    projects.write_text(yaml.safe_dump({
        "projects": {
            "alpha": {
                "slug": "alpha", "name": "Alpha", "description": "d",
                "ads_path": "ads.yaml",  # relative!
                "renders_path": "renders/",
                "brand_path": "brand/",
                "created_at": "2026-04-18T00:00:00Z",
            }
        }
    }))
    store = ProjectStore(projects_yaml=projects)
    items = store.list()
    assert len(items) == 1
    assert items[0].ad_count == 1
    assert items[0].variant_count == 1
