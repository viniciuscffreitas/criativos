import pytest
from fastapi.testclient import TestClient

from features.web_gui.server import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    import yaml
    projects = tmp_path / "projects.yaml"
    ads = tmp_path / "ads.yaml"
    projects.write_text(yaml.safe_dump({
        "projects": {"vibeweb": {
            "slug": "vibeweb", "name": "Vibe Web", "description": "",
            "ads_path": str(ads), "renders_path": str(tmp_path/"renders"),
            "brand_path": str(tmp_path/"brand"),
            "created_at": "2026-04-18T00:00:00Z",
        }}
    }))
    ads.write_text(yaml.safe_dump({"ads": {}}))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))
    app = create_app()
    return TestClient(app)


def test_list_projects(client):
    r = client.get("/api/v1/projects")
    assert r.status_code == 200
    body = r.json()
    assert "projects" in body
    assert body["projects"][0]["slug"] == "vibeweb"


def test_get_project_by_slug(client):
    r = client.get("/api/v1/projects/vibeweb")
    assert r.status_code == 200
    assert r.json()["name"] == "Vibe Web"


def test_get_missing_project_returns_404(client):
    r = client.get("/api/v1/projects/ghost")
    assert r.status_code == 404
    body = r.json()
    assert body["code"] == "PROJECT_NOT_FOUND"


def test_create_app_raises_when_ui_required_but_missing(tmp_path, monkeypatch):
    import yaml
    projects = tmp_path / "projects.yaml"
    ads = tmp_path / "ads.yaml"
    projects.write_text(yaml.safe_dump({"projects": {}}))
    ads.write_text(yaml.safe_dump({"ads": {}}))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))
    monkeypatch.setenv("VIBEWEB_REQUIRE_UI", "1")

    # Patch the binding `server.py` actually calls (it imported static_dir
    # by name at module load, so patching settings.static_dir wouldn't reach it).
    monkeypatch.setattr(
        "features.web_gui.server.static_dir",
        lambda: tmp_path / "definitely_missing_static",
    )

    from features.web_gui.server import create_app
    with pytest.raises(RuntimeError, match="static dir not found"):
        create_app()


def test_list_projects_returns_500_when_ads_path_missing(tmp_path, monkeypatch):
    import yaml
    projects = tmp_path / "projects.yaml"
    missing_ads = tmp_path / "no_such_file.yaml"
    projects.write_text(yaml.safe_dump({
        "projects": {"vibeweb": {
            "slug": "vibeweb", "name": "Vibe Web", "description": "",
            "ads_path": str(missing_ads),
            "renders_path": str(tmp_path / "renders"),
            "brand_path": str(tmp_path / "brand"),
            "created_at": "2026-04-18T00:00:00Z",
        }}
    }))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))

    from features.web_gui.server import create_app
    from fastapi.testclient import TestClient
    client = TestClient(create_app())

    r = client.get("/api/v1/projects")
    assert r.status_code == 500
    assert r.json()["code"] == "ADS_FILE_NOT_FOUND"


def test_get_project_returns_500_when_ads_path_missing(tmp_path, monkeypatch):
    import yaml
    projects = tmp_path / "projects.yaml"
    missing_ads = tmp_path / "no_such_file.yaml"
    projects.write_text(yaml.safe_dump({
        "projects": {"vibeweb": {
            "slug": "vibeweb", "name": "Vibe Web", "description": "",
            "ads_path": str(missing_ads),
            "renders_path": str(tmp_path / "renders"),
            "brand_path": str(tmp_path / "brand"),
            "created_at": "2026-04-18T00:00:00Z",
        }}
    }))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))

    from features.web_gui.server import create_app
    from fastapi.testclient import TestClient
    client = TestClient(create_app())

    r = client.get("/api/v1/projects/vibeweb")
    assert r.status_code == 500
    assert r.json()["code"] == "ADS_FILE_NOT_FOUND"


import yaml


def _seed_ad(client, ads_path):
    ads_path.write_text(yaml.safe_dump({
        "ads": {
            "01_portfolio_grid": {
                "id": "01", "slug": "portfolio-grid",
                "brief": {"product": "p", "audience": "a", "pain": "pa",
                          "social_proof": "sp", "ctas": ["Message me"]},
                "variants": [],
            }
        }
    }))


def test_get_brief(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    _seed_ad(client, ads)
    r = client.get("/api/v1/projects/vibeweb/ads/01/brief")
    assert r.status_code == 200
    assert r.json()["ctas"] == ["Message me"]


def test_put_brief_persists(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    _seed_ad(client, ads)
    new_brief = {
        "product": "new product", "audience": "new aud", "pain": "new pain",
        "social_proof": None, "ctas": ["Click me", "Order now"],
    }
    r = client.put("/api/v1/projects/vibeweb/ads/01/brief", json=new_brief)
    assert r.status_code == 200
    assert r.json()["updated"] is True
    data = yaml.safe_load(ads.read_text())
    assert data["ads"]["01_portfolio_grid"]["brief"]["ctas"] == ["Click me", "Order now"]
