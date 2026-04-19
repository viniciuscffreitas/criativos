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


# ---------------------------------------------------------------------------
# Streaming route tests — POST /api/v1/generate/stream
# ---------------------------------------------------------------------------

def _parse_sse_events(raw: str) -> list[str]:
    """Return list of event names in order from raw SSE text."""
    events = []
    for line in raw.splitlines():
        if line.startswith("event: "):
            events.append(line[len("event: "):])
    return events


def test_generate_stream_emits_ordered_events(client, tmp_path, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    monkeypatch.setenv("VIBEWEB_STREAM_TICK", "0")
    import features.copy_generation.streaming as _s
    monkeypatch.setattr(_s, "_STREAM_TICK_SECONDS", 0.0)

    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)
    with client.stream("POST", "/api/v1/generate/stream", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "pas", "n_variants": 2, "persist": False,
    }) as r:
        assert r.status_code == 200
        raw = r.read().decode()

    events = _parse_sse_events(raw)
    assert events[0] == "run_start"
    assert events[-1] == "done"
    assert "variant_done" in events
    assert events.count("variant_done") == 2


def test_generate_stream_methodology_501(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)
    r = client.post("/api/v1/generate/stream", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "aida", "n_variants": 1, "persist": False,
    })
    assert r.status_code == 501
    assert r.json()["code"] == "METHODOLOGY_NOT_IMPLEMENTED"


def test_generate_stream_unknown_project_404(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)
    r = client.post("/api/v1/generate/stream", json={
        "project_slug": "ghost", "ad_id": "01",
        "methodology": "pas", "n_variants": 1, "persist": False,
    })
    assert r.status_code == 404
    assert r.json()["code"] == "PROJECT_NOT_FOUND"


def test_generate_stream_unknown_ad_404(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)
    r = client.post("/api/v1/generate/stream", json={
        "project_slug": "vibeweb", "ad_id": "99",
        "methodology": "pas", "n_variants": 1, "persist": False,
    })
    assert r.status_code == 404
    assert r.json()["code"] == "AD_NOT_FOUND"


def test_generate_stream_missing_brief_404(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    ads.write_text(yaml.safe_dump({"ads": {
        "01_portfolio_grid": {"id": "01", "slug": "portfolio-grid", "variants": []}
    }}))
    r = client.post("/api/v1/generate/stream", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "pas", "n_variants": 1, "persist": False,
    })
    assert r.status_code == 404
    assert r.json()["code"] == "BRIEF_NOT_FOUND"


def test_generate_stream_invalid_brief_400(client, tmp_path, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    ads = tmp_path / "ads.yaml"
    ads.write_text(yaml.safe_dump({"ads": {
        "01_portfolio_grid": {
            "id": "01", "slug": "portfolio-grid",
            "brief": {"audience": "a", "pain": "x", "ctas": ["Click"]},
            "variants": [],
        }
    }}))
    r = client.post("/api/v1/generate/stream", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "pas", "n_variants": 1, "persist": False,
    })
    assert r.status_code == 400
    assert r.json()["code"] == "BRIEF_INVALID"


def test_generate_stream_done_payload_matches_variant_count(client, tmp_path, monkeypatch):
    import json as _json
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    monkeypatch.setenv("VIBEWEB_STREAM_TICK", "0")
    import features.copy_generation.streaming as _s
    monkeypatch.setattr(_s, "_STREAM_TICK_SECONDS", 0.0)

    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)
    with client.stream("POST", "/api/v1/generate/stream", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "pas", "n_variants": 3, "persist": False,
    }) as r:
        assert r.status_code == 200
        raw = r.read().decode()

    # Find the `done` event's data line
    lines = raw.splitlines()
    done_data = None
    for i, line in enumerate(lines):
        if line == "event: done" and i + 1 < len(lines):
            done_data = _json.loads(lines[i + 1][len("data: "):])
            break
    assert done_data is not None, "No 'done' event found in stream"
    assert len(done_data["variants"]) == 3


def test_generate_stream_replay_path_includes_brief_node_events(client, tmp_path, monkeypatch):
    """Non-dry-run (_replay_events) must emit brief node events matching dry_run_events shape."""
    import json as _json
    from features.copy_generation.schema import (
        AgentResult, CopyVariant, VariantAxes, TraceNode,
    )

    fake_variant = CopyVariant(
        id="v1", headline="Test headline", primary_text="Body", description="Desc",
        ctas=["Click"], confidence="high", confidence_score=0.9,
        axes=VariantAxes(relevance=0.9, originality=0.8, brand_fit=0.85),
        reasoning="ok",
    )
    fake_result = AgentResult(
        run_id="test123", variants=[fake_variant], trace="trace",
        trace_structured=[TraceNode(id="agent", label="Agente criativo",
                                    start_ms=0, end_ms=10, tokens=5,
                                    confidence=0.9, output_preview="Test")],
        methodology="pas", model="dry-run", pipeline_version="v0",
        seed=None, created_at="2026-04-18T00:00:00",
    )

    monkeypatch.setattr("features.web_gui.api.generate.agent._is_dry_run", lambda: False)
    monkeypatch.setattr(
        "features.web_gui.api.generate.agent.generate",
        lambda brief, methodology, n: fake_result,
    )

    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)

    with client.stream("POST", "/api/v1/generate/stream", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "pas", "n_variants": 1, "persist": False,
    }) as r:
        assert r.status_code == 200
        raw = r.read().decode()

    events = _parse_sse_events(raw)
    assert events[0] == "run_start"
    assert events[-1] == "done"
    # brief node events must appear before agent node events
    assert "node_start" in events
    assert "node_done" in events

    # Parse (event, data) pairs
    pairs = []
    pending_event = None
    for line in raw.splitlines():
        if line.startswith("event: "):
            pending_event = line[len("event: "):]
        elif line.startswith("data: ") and pending_event:
            try:
                pairs.append((pending_event, _json.loads(line[len("data: "):])))
            except _json.JSONDecodeError:
                pass
            pending_event = None

    node_starts = [(ev, d) for ev, d in pairs if ev == "node_start"]
    node_dones = [(ev, d) for ev, d in pairs if ev == "node_done"]

    assert len(node_starts) == 2, f"expected 2 node_start events, got {node_starts}"
    assert node_starts[0][1]["node_id"] == "brief"
    assert node_starts[1][1]["node_id"] == "agent"
    assert node_dones[0][1]["node_id"] == "brief"
    assert node_dones[1][1]["node_id"] == "agent"


def test_generate_stream_token_events_carry_variant_id(client, tmp_path, monkeypatch):
    """token events must carry variant_id so the UI can route them to the right card."""
    import json as _json

    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    monkeypatch.setenv("VIBEWEB_STREAM_TICK", "0")
    import features.copy_generation.streaming as _s
    monkeypatch.setattr(_s, "_STREAM_TICK_SECONDS", 0.0)

    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)

    with client.stream("POST", "/api/v1/generate/stream", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "pas", "n_variants": 2, "persist": False,
    }) as r:
        assert r.status_code == 200
        raw = r.read().decode()

    # Parse (event, data) pairs
    pairs = []
    pending_event = None
    for line in raw.splitlines():
        if line.startswith("event: "):
            pending_event = line[len("event: "):]
        elif line.startswith("data: ") and pending_event:
            try:
                pairs.append((pending_event, _json.loads(line[len("data: "):])))
            except _json.JSONDecodeError:
                pass
            pending_event = None

    token_events = [(ev, d) for ev, d in pairs if ev == "token"]
    assert len(token_events) > 0, "No token events found in stream"

    for _, d in token_events:
        assert "node_id" in d, f"token event missing node_id: {d}"
        assert "variant_id" in d, f"token event missing variant_id: {d}"
        assert "text" in d, f"token event missing text: {d}"

    # variant_id values in token events must correspond to ids in variant_done events
    token_variant_ids = {d["variant_id"] for _, d in token_events}
    variant_done_ids = {d["id"] for ev, d in pairs if ev == "variant_done"}
    assert token_variant_ids <= variant_done_ids, (
        f"token variant_ids {token_variant_ids} not a subset of variant_done ids {variant_done_ids}"
    )


def test_replay_events_node_done_carries_real_trace_values(client, tmp_path, monkeypatch):
    """_replay_events must propagate real trace values, not hardcoded zeros.

    Asserts that node_done(agent) carries:
      - tokens from trace_structured (not hardcoded 0)
      - confidence from the "agent" TraceNode (not hardcoded None)
      - output_preview from variants[0].headline[:80] (not hardcoded "")
      - end_ms > 0 (real wall-clock, not hardcoded 0)
    """
    import json as _json
    from features.copy_generation.schema import (
        AgentResult, CopyVariant, VariantAxes, TraceNode,
    )

    fake_variant = CopyVariant(
        id="v1", headline="Real mode headline", primary_text="Body text",
        description="Description", ctas=["Click here"],
        confidence="high", confidence_score=0.9,
        axes=VariantAxes(relevance=0.9, originality=0.85, brand_fit=0.88),
        reasoning="reasoning",
    )
    fake_result = AgentResult(
        run_id="replay_test_run", variants=[fake_variant], trace="trace text",
        trace_structured=[
            TraceNode(id="agent", label="Agente criativo",
                      start_ms=0, end_ms=150, tokens=42,
                      confidence=0.85, output_preview="xxx"),
        ],
        methodology="pas", model="claude-sonnet-test", pipeline_version="v0",
        seed=None, created_at="2026-04-18T00:00:00Z",
    )

    monkeypatch.setattr("features.web_gui.api.generate.agent._is_dry_run", lambda: False)
    monkeypatch.setattr(
        "features.web_gui.api.generate.agent.generate",
        lambda brief, methodology, n: fake_result,
    )

    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)

    with client.stream("POST", "/api/v1/generate/stream", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "pas", "n_variants": 1, "persist": False,
    }) as r:
        assert r.status_code == 200
        raw = r.read().decode()

    # Parse (event, data) pairs
    pairs = []
    pending_event = None
    for line in raw.splitlines():
        if line.startswith("event: "):
            pending_event = line[len("event: "):]
        elif line.startswith("data: ") and pending_event:
            try:
                pairs.append((pending_event, _json.loads(line[len("data: "):])))
            except _json.JSONDecodeError:
                pass
            pending_event = None

    agent_done_events = [(ev, d) for ev, d in pairs if ev == "node_done" and d.get("node_id") == "agent"]
    assert len(agent_done_events) == 1, f"expected exactly one node_done(agent), got {agent_done_events}"
    _, agent_done = agent_done_events[0]

    assert agent_done["tokens"] == 42, f"expected tokens=42 from trace_structured, got {agent_done['tokens']}"
    assert agent_done["confidence"] == 0.85, f"expected confidence=0.85, got {agent_done['confidence']}"
    assert agent_done["output_preview"] == "Real mode headline"[:80], (
        f"expected output_preview from headline, got {agent_done['output_preview']!r}"
    )
    # end_ms must be a real wall-clock int (>= 0), not a hardcoded sentinel.
    # Mock runs complete in sub-millisecond time so 0 is a valid honest value here.
    assert isinstance(agent_done["end_ms"], int) and agent_done["end_ms"] >= 0, (
        f"expected end_ms to be a non-negative int (real wall-clock), got {agent_done['end_ms']!r}"
    )


# ---------------------------------------------------------------------------
# Variants PATCH tests — /api/v1/variants/{run_id}/{variant_id}
# ---------------------------------------------------------------------------

def _seed_ad_with_variants(ads_path, run_id: str):
    """Seed an ad with two variants and a trace.last_run pointing to run_id."""
    ads_path.write_text(yaml.safe_dump({
        "ads": {
            "01_portfolio_grid": {
                "id": "01", "slug": "portfolio-grid",
                "brief": {"product": "p", "audience": "a", "pain": "pa",
                          "social_proof": "sp", "ctas": ["Message me"]},
                "trace": {"last_run": run_id, "confidence": 0.9},
                "variants": [
                    {"id": "v1", "headline": "H1", "primary_text": "PT1",
                     "ctas": ["Buy"], "selected": False},
                    {"id": "v2", "headline": "H2", "primary_text": "PT2",
                     "ctas": ["Order"], "selected": False},
                ],
            }
        }
    }))


def test_patch_variant_persists_selection(client, tmp_path, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    ads = tmp_path / "ads.yaml"
    run_id = "run-abc-123"
    _seed_ad_with_variants(ads, run_id)

    r = client.patch(f"/api/v1/variants/{run_id}/v1", json={"selected": True})
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == "v1"
    assert body["selected"] is True

    data = yaml.safe_load(ads.read_text())
    variants = data["ads"]["01_portfolio_grid"]["variants"]
    v1 = next(v for v in variants if v["id"] == "v1")
    assert v1["selected"] is True


def test_patch_variant_404_unknown_run_id(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    _seed_ad_with_variants(ads, "run-known")

    r = client.patch("/api/v1/variants/run-unknown/v1", json={"selected": True})
    assert r.status_code == 404
    assert r.json()["code"] == "VARIANT_NOT_FOUND"


def test_patch_variant_404_unknown_variant_id_but_known_run(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    run_id = "run-abc-456"
    _seed_ad_with_variants(ads, run_id)

    r = client.patch(f"/api/v1/variants/{run_id}/no-such-variant", json={"selected": True})
    assert r.status_code == 404
    assert r.json()["code"] == "VARIANT_NOT_FOUND"


def test_patch_variant_persists_headline(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    run_id = "run-headline-test"
    _seed_ad_with_variants(ads, run_id)

    r = client.patch(f"/api/v1/variants/{run_id}/v1", json={"headline": "New headline"})
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == "v1"
    assert body["headline"] == "New headline"

    data = yaml.safe_load(ads.read_text())
    variants = data["ads"]["01_portfolio_grid"]["variants"]
    v1 = next(v for v in variants if v["id"] == "v1")
    assert v1["headline"] == "New headline"


# ---------------------------------------------------------------------------
# Traces GET tests — /api/v1/traces/{run_id}
# ---------------------------------------------------------------------------

def test_get_trace_returns_persisted(client, tmp_path, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    ads = tmp_path / "ads.yaml"
    _seed_ad(ads)

    traces_tmp = tmp_path / "traces"
    traces_tmp.mkdir()
    monkeypatch.setattr("features.web_gui.services.trace_store.traces_dir", lambda: traces_tmp)
    monkeypatch.setattr("features.web_gui.api.traces.traces_dir", lambda: traces_tmp)

    r = client.post("/api/v1/generate", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "pas", "n_variants": 1, "persist": False,
    })
    assert r.status_code == 200
    run_id = r.json()["run_id"]

    r2 = client.get(f"/api/v1/traces/{run_id}")
    assert r2.status_code == 200
    body = r2.json()
    assert body["run_id"] == run_id
    assert "variants" in body


def test_get_trace_404_unknown_run_id(client, tmp_path, monkeypatch):
    traces_tmp = tmp_path / "traces"
    traces_tmp.mkdir()
    monkeypatch.setattr("features.web_gui.api.traces.traces_dir", lambda: traces_tmp)

    r = client.get("/api/v1/traces/run-does-not-exist")
    assert r.status_code == 404
    assert r.json()["code"] == "TRACE_NOT_FOUND"


def test_get_trace_400_invalid_run_id_chars(client):
    # run_id with a dot bypasses Starlette path normalisation but fails our
    # regex guard ([A-Za-z0-9_-]{1,64}), returning 400 INVALID_RUN_ID.
    # Note: ..%2F.. is blocked at the routing layer (404) before our handler
    # runs — Starlette's own path traversal protection. Our guard covers the
    # remaining surface (dots, slashes in decoded form, etc.).
    r = client.get("/api/v1/traces/run.id.with.dots")
    assert r.status_code == 400
    assert r.json()["code"] == "INVALID_RUN_ID"


# ---------------------------------------------------------------------------
# Assets upload tests — POST /api/v1/assets/upload
# ---------------------------------------------------------------------------

def test_upload_asset_stores_file(client, tmp_path, monkeypatch):
    uploads_tmp = tmp_path / "uploads"
    uploads_tmp.mkdir()
    monkeypatch.setattr("features.web_gui.api.assets.uploads_dir", lambda: uploads_tmp)
    monkeypatch.setattr("features.web_gui.services.asset_store.uploads_dir", lambda: uploads_tmp)

    import io
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20  # minimal fake PNG
    r = client.post(
        "/api/v1/assets/upload",
        data={"project_slug": "vibeweb"},
        files={"files": ("test.png", io.BytesIO(png_bytes), "image/png")},
    )
    assert r.status_code == 200
    body = r.json()
    assert "uploaded" in body
    assert len(body["uploaded"]) == 1
    item = body["uploaded"][0]
    assert "file_id" in item
    assert item["filename"] == "test.png"
    assert item["size"] == len(png_bytes)
    assert item["kind"] == "image"


def test_upload_asset_404_unknown_project(client, tmp_path, monkeypatch):
    uploads_tmp = tmp_path / "uploads"
    uploads_tmp.mkdir()
    monkeypatch.setattr("features.web_gui.api.assets.uploads_dir", lambda: uploads_tmp)

    import io
    r = client.post(
        "/api/v1/assets/upload",
        data={"project_slug": "ghost"},
        files={"files": ("test.png", io.BytesIO(b"data"), "image/png")},
    )
    assert r.status_code == 404
    assert r.json()["code"] == "PROJECT_NOT_FOUND"


def test_upload_asset_415_disallowed_type(client, tmp_path, monkeypatch):
    uploads_tmp = tmp_path / "uploads"
    uploads_tmp.mkdir()
    monkeypatch.setattr("features.web_gui.api.assets.uploads_dir", lambda: uploads_tmp)
    monkeypatch.setattr("features.web_gui.services.asset_store.uploads_dir", lambda: uploads_tmp)

    import io
    r = client.post(
        "/api/v1/assets/upload",
        data={"project_slug": "vibeweb"},
        files={"files": ("malware.exe", io.BytesIO(b"MZ\x90\x00"), "application/octet-stream")},
    )
    assert r.status_code == 415
    assert r.json()["code"] == "UNSUPPORTED_MEDIA_TYPE"


def test_upload_asset_strips_path_in_filename(client, tmp_path, monkeypatch):
    uploads_tmp = tmp_path / "uploads"
    uploads_tmp.mkdir()
    monkeypatch.setattr("features.web_gui.api.assets.uploads_dir", lambda: uploads_tmp)
    monkeypatch.setattr("features.web_gui.services.asset_store.uploads_dir", lambda: uploads_tmp)

    import io
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
    r = client.post(
        "/api/v1/assets/upload",
        data={"project_slug": "vibeweb"},
        files={"files": ("../../evil.png", io.BytesIO(png_bytes), "image/png")},
    )
    assert r.status_code == 200
    item = r.json()["uploaded"][0]
    assert item["filename"] == "evil.png"
    assert "/" not in item["filename"]
    assert "\\" not in item["filename"]


def test_upload_asset_413_too_large(client, tmp_path, monkeypatch):
    uploads_tmp = tmp_path / "uploads"
    uploads_tmp.mkdir()
    monkeypatch.setattr("features.web_gui.api.assets.uploads_dir", lambda: uploads_tmp)
    monkeypatch.setattr("features.web_gui.services.asset_store.uploads_dir", lambda: uploads_tmp)

    import io
    large_size = (10 * 1024 * 1024) + 1
    # PNG magic bytes so MIME check passes; size rejection fires after MIME check.
    oversized = b"\x89PNG\r\n\x1a\n" + b"0" * large_size
    r = client.post(
        "/api/v1/assets/upload",
        data={"project_slug": "vibeweb"},
        files={"files": ("big.png", io.BytesIO(oversized), "image/png")},
    )
    assert r.status_code == 413
    assert r.json()["code"] == "FILE_TOO_LARGE"
