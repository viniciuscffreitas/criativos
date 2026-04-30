"""Contract tests for /api/v1/studio/request — orchestrator is mocked."""
from __future__ import annotations

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
            "ads_path": str(ads),
            "renders_path": str(tmp_path / "renders"),
            "brand_path": str(tmp_path / "brand"),
            "created_at": "2026-04-30T00:00:00Z",
        }}
    }))
    ads.write_text(yaml.safe_dump({"ads": {}}))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))
    return TestClient(create_app())


def test_post_studio_request_returns_event_stream(client, monkeypatch):
    async def _fake_stream(req, **_):
        yield "event: run_start\ndata: {\"run_id\":\"x\"}\n\n"
        yield "event: done\ndata: {}\n\n"

    monkeypatch.setattr(
        "features.studio_agent.orchestrator.stream", _fake_stream,
    )

    with client.stream(
        "POST", "/api/v1/studio/request",
        json={"prompt": "ad about new service"},
    ) as r:
        assert r.status_code == 200
        assert "text/event-stream" in r.headers["content-type"]
        raw = r.read().decode()

    assert "event: run_start" in raw
    assert "event: done" in raw


def test_post_studio_request_passes_n_variants(client, monkeypatch):
    captured = {"n": None}

    async def _fake_stream(req, **_):
        captured["n"] = req.n_variants
        yield "event: done\ndata: {}\n\n"

    monkeypatch.setattr(
        "features.studio_agent.orchestrator.stream", _fake_stream,
    )

    client.post("/api/v1/studio/request",
                json={"prompt": "x", "n_variants": 5})
    assert captured["n"] == 5


def test_post_studio_request_400_on_empty_prompt(client):
    r = client.post("/api/v1/studio/request", json={"prompt": "  "})
    assert r.status_code == 400
    assert r.json()["code"] == "INVALID_REQUEST"


def test_post_studio_request_422_on_missing_prompt(client):
    r = client.post("/api/v1/studio/request", json={})
    assert r.status_code == 422  # Pydantic field-level


def test_post_studio_request_422_on_invalid_n_variants(client):
    r = client.post("/api/v1/studio/request",
                    json={"prompt": "x", "n_variants": 0})
    assert r.status_code == 422
