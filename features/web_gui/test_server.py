import pytest
import yaml
from fastapi.testclient import TestClient

from features.web_gui.server import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
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


def test_create_app_raises_when_renders_required_but_missing(tmp_path, monkeypatch):
    import yaml
    projects = tmp_path / "projects.yaml"
    ads = tmp_path / "ads.yaml"
    projects.write_text(yaml.safe_dump({"projects": {}}))
    ads.write_text(yaml.safe_dump({"ads": {}}))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))
    monkeypatch.setenv("VIBEWEB_REQUIRE_RENDERS", "1")

    monkeypatch.setattr(
        "features.web_gui.server.renders_dir",
        lambda: tmp_path / "definitely_missing_renders",
    )

    from features.web_gui.server import create_app
    with pytest.raises(RuntimeError, match="renders dir not found"):
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


def _seed_ad(ads_path):
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
    _seed_ad(ads)
    r = client.get("/api/v1/projects/vibeweb/ads/01/brief")
    assert r.status_code == 200
    assert r.json()["ctas"] == ["Message me"]


def test_put_brief_persists(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)
    new_brief = {
        "product": "new product", "audience": "new aud", "pain": "new pain",
        "social_proof": None, "ctas": ["Click me", "Order now"],
    }
    r = client.put("/api/v1/projects/vibeweb/ads/01/brief", json=new_brief)
    assert r.status_code == 200
    assert r.json()["updated"] is True
    data = yaml.safe_load(ads.read_text())
    assert data["ads"]["01_portfolio_grid"]["brief"]["ctas"] == ["Click me", "Order now"]


def test_get_brief_returns_404_when_ad_has_no_brief(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    ads.write_text(yaml.safe_dump({
        "ads": {
            "01_portfolio_grid": {
                "id": "01", "slug": "portfolio-grid",
                "variants": [],
            }
        }
    }))
    r = client.get("/api/v1/projects/vibeweb/ads/01/brief")
    assert r.status_code == 404
    assert r.json()["code"] == "BRIEF_NOT_FOUND"


def test_get_brief_returns_404_when_ad_id_unknown(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)
    r = client.get("/api/v1/projects/vibeweb/ads/99/brief")
    assert r.status_code == 404
    assert r.json()["code"] == "AD_NOT_FOUND"


def test_put_brief_returns_404_when_ad_id_unknown(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)
    new_brief = {
        "product": "x", "audience": "y", "pain": "z",
        "social_proof": None, "ctas": ["c"],
    }
    r = client.put("/api/v1/projects/vibeweb/ads/99/brief", json=new_brief)
    assert r.status_code == 404
    assert r.json()["code"] == "AD_NOT_FOUND"


# ---------------------------------------------------------------------------
# Creatives route tests
# ---------------------------------------------------------------------------

def test_list_creatives_shapes_match_contract(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    ads.write_text(yaml.safe_dump({
        "ads": {
            "01_portfolio_grid": {
                "id": "01", "slug": "portfolio-grid",
                "kind": "image", "placement": "Instagram Feed · 1:1",
                "format": "1080×1080 png",
                "brief": {"product": "p", "audience": "a", "pain": "x",
                          "ctas": ["Click"], "social_proof": None},
                "copy": {"hero": "Hero text"},
                "meta": {"headline": "H", "primary_text": "PT", "description": "D"},
                "variants": [],
            }
        }
    }))
    r = client.get("/api/v1/projects/vibeweb/creatives")
    assert r.status_code == 200
    body = r.json()
    assert len(body["creatives"]) == 1
    c = body["creatives"][0]
    assert c["id"] == "portfolio-grid-base"
    assert c["kind"] == "image"
    assert c["thumbnail_url"] == "/renders/01-portfolio-grid.png"
    assert c["ctas"] == ["Click"]


def test_list_creatives_unknown_project_returns_404(client):
    r = client.get("/api/v1/projects/ghost/creatives")
    assert r.status_code == 404
    assert r.json()["code"] == "PROJECT_NOT_FOUND"


def test_list_creatives_missing_ads_yaml_returns_500(tmp_path, monkeypatch):
    projects = tmp_path / "projects.yaml"
    missing_ads = tmp_path / "no_such_ads.yaml"
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
    from fastapi.testclient import TestClient
    c = TestClient(create_app())
    r = c.get("/api/v1/projects/vibeweb/creatives")
    assert r.status_code == 500
    assert r.json()["code"] == "ADS_FILE_NOT_FOUND"


def test_list_creatives_kind_filter(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    ads.write_text(yaml.safe_dump({
        "ads": {
            "01_portfolio_grid": {
                "id": "01", "slug": "portfolio-grid",
                "kind": "image", "placement": "IG Feed", "format": "1080×1080 png",
                "brief": {"product": "p", "audience": "a", "pain": "x",
                          "ctas": ["Click"], "social_proof": None},
                "copy": {"hero": "Hero"}, "meta": {}, "variants": [],
            }
        }
    }))
    r = client.get("/api/v1/projects/vibeweb/creatives?kind=video")
    assert r.status_code == 200
    assert r.json()["creatives"] == []


def test_list_creatives_returns_500_when_project_missing_ads_path(tmp_path, monkeypatch):
    projects = tmp_path / "projects.yaml"
    projects.write_text(yaml.safe_dump({
        "projects": {"vibeweb": {
            "slug": "vibeweb", "name": "Vibe Web", "description": "",
            # ads_path intentionally absent
            "renders_path": str(tmp_path / "renders"),
            "brand_path": str(tmp_path / "brand"),
            "created_at": "2026-04-18T00:00:00Z",
        }}
    }))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))
    from fastapi.testclient import TestClient
    c = TestClient(create_app())
    r = c.get("/api/v1/projects/vibeweb/creatives")
    assert r.status_code == 500
    assert r.json()["code"] == "PROJECT_MISCONFIGURED"


def test_list_creatives_variant_expansion(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    ads.write_text(yaml.safe_dump({
        "ads": {
            "01_portfolio_grid": {
                "id": "01", "slug": "portfolio-grid",
                "kind": "image", "placement": "IG Feed", "format": "1080×1080 png",
                "brief": {"product": "p", "audience": "a", "pain": "x",
                          "ctas": ["Click"], "social_proof": None},
                "copy": {"hero": "Hero"}, "meta": {},
                "variants": [
                    {"id": "A", "headline": "Headline A", "primary_text": "PT A", "ctas": ["Buy A"]},
                    {"id": "B", "headline": "Headline B", "primary_text": "PT B", "ctas": ["Buy B"]},
                ],
            }
        }
    }))
    r = client.get("/api/v1/projects/vibeweb/creatives")
    assert r.status_code == 200
    creatives = r.json()["creatives"]
    ids = [c["id"] for c in creatives]
    # Ordering: base at index 0, variants follow in YAML order
    assert ids == ["portfolio-grid-base", "portfolio-grid-a", "portfolio-grid-b"]
    assert [c["variant_id"] for c in creatives] == [None, "A", "B"]


def test_list_creatives_empty_kind_returns_422(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)
    r = client.get("/api/v1/projects/vibeweb/creatives?kind=")
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Generate route tests
# ---------------------------------------------------------------------------

def test_generate_dry_run_returns_n_variants(client, tmp_path, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)  # existing helper from Task 6 — has 1 CTA
    r = client.post("/api/v1/generate", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "pas", "n_variants": 3, "persist": False,
    })
    assert r.status_code == 200
    body = r.json()
    assert len(body["variants"]) == 3
    assert body["methodology"] == "pas"
    assert body["model"] == "dry-run"
    assert body["run_id"]  # non-empty


def test_generate_unknown_methodology_501(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)
    r = client.post("/api/v1/generate", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "aida", "n_variants": 3, "persist": False,
    })
    assert r.status_code == 501
    assert r.json()["code"] == "METHODOLOGY_NOT_IMPLEMENTED"


def test_generate_npqel_stub_501(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)
    r = client.post("/api/v1/generate", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "npqel", "n_variants": 3, "persist": False,
    })
    assert r.status_code == 501


def test_generate_unknown_project_returns_404(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)
    r = client.post("/api/v1/generate", json={
        "project_slug": "ghost", "ad_id": "01",
        "methodology": "pas", "n_variants": 1, "persist": False,
    })
    assert r.status_code == 404
    assert r.json()["code"] == "PROJECT_NOT_FOUND"


def test_generate_unknown_ad_returns_404(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)
    r = client.post("/api/v1/generate", json={
        "project_slug": "vibeweb", "ad_id": "99",
        "methodology": "pas", "n_variants": 1, "persist": False,
    })
    assert r.status_code == 404
    assert r.json()["code"] == "AD_NOT_FOUND"


def test_generate_missing_brief_returns_404(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    ads.write_text(yaml.safe_dump({"ads": {
        "01_portfolio_grid": {"id": "01", "slug": "portfolio-grid", "variants": []}
    }}))
    r = client.post("/api/v1/generate", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "pas", "n_variants": 1, "persist": False,
    })
    assert r.status_code == 404
    assert r.json()["code"] == "BRIEF_NOT_FOUND"


def test_generate_invalid_brief_empty_ctas_returns_400(client, tmp_path, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    ads = tmp_path / "ads.yaml"
    ads.write_text(yaml.safe_dump({"ads": {
        "01_portfolio_grid": {
            "id": "01", "slug": "portfolio-grid",
            "brief": {"product": "p", "audience": "a", "pain": "x",
                      "ctas": [], "social_proof": None},
            "variants": [],
        }
    }}))
    r = client.post("/api/v1/generate", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "pas", "n_variants": 1, "persist": False,
    })
    assert r.status_code == 400
    assert r.json()["code"] == "BRIEF_INVALID"
    assert "cta" in r.json()["error"].lower()


def test_generate_invalid_brief_missing_product_returns_400(client, tmp_path, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    ads = tmp_path / "ads.yaml"
    ads.write_text(yaml.safe_dump({"ads": {
        "01_portfolio_grid": {
            "id": "01", "slug": "portfolio-grid",
            "brief": {"audience": "a", "pain": "x", "ctas": ["Click"]},
            "variants": [],
        }
    }}))
    r = client.post("/api/v1/generate", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "pas", "n_variants": 1, "persist": False,
    })
    assert r.status_code == 400
    assert r.json()["code"] == "BRIEF_INVALID"
    assert "product" in r.json()["error"]


def test_generate_persist_true_writes_variants_and_trace(client, tmp_path, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)
    r = client.post("/api/v1/generate", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "pas", "n_variants": 2, "persist": True,
    })
    assert r.status_code == 200
    run_id = r.json()["run_id"]
    data = yaml.safe_load(ads.read_text())
    assert len(data["ads"]["01_portfolio_grid"]["variants"]) == 2
    assert data["ads"]["01_portfolio_grid"]["trace"]["last_run"] == run_id
    assert isinstance(data["ads"]["01_portfolio_grid"]["trace"]["confidence"], float)


def test_generate_trace_saved_even_when_not_persisted(client, tmp_path, monkeypatch):
    # trace_store.save is ALWAYS called, regardless of persist flag
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)
    # Override traces_dir to a predictable tmp location
    traces_tmp = tmp_path / "traces"
    traces_tmp.mkdir()
    monkeypatch.setattr("features.web_gui.services.trace_store.traces_dir",
                        lambda: traces_tmp)
    r = client.post("/api/v1/generate", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "pas", "n_variants": 1, "persist": False,
    })
    assert r.status_code == 200
    run_id = r.json()["run_id"]
    trace_file = traces_tmp / f"{run_id}.json"
    assert trace_file.exists()
    import json
    loaded = json.loads(trace_file.read_text())
    assert loaded["run_id"] == run_id
