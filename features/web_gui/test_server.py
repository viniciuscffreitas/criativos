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
