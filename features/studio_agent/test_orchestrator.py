"""Tests for studio_agent.orchestrator — assembles plan -> copy -> render
with the SSE event stream the UI consumes."""
from __future__ import annotations

import json
from typing import Any

import pytest

from features.copy_generation.schema import (
    AgentResult, Brief, CopyVariant, VariantAxes,
)
from features.studio_agent import orchestrator
from features.studio_agent.schema import StudioPlan, StudioRequest
from features.web_gui.services.render_service import (
    RenderItem, RenderReport, RenderResult,
)


def _events(raw: str) -> list[tuple[str, dict]]:
    out: list[tuple[str, dict]] = []
    pending: str | None = None
    for line in raw.splitlines():
        if line.startswith("event: "):
            pending = line[len("event: "):]
        elif line.startswith("data: ") and pending:
            out.append((pending, json.loads(line[len("data: "):])))
            pending = None
    return out


def _stub_plan() -> StudioPlan:
    return StudioPlan(
        category="meta-ads", template_id="01-portfolio-grid",
        methodology="pas",
        brief=Brief(product="p", audience="a", pain="x", ctas=["go"]),
        n_variants=2, reasoning="ok",
    )


def _stub_agent_result() -> AgentResult:
    v = CopyVariant(
        id="V1", headline="H1", primary_text="P1", description="D1",
        ctas=["go"], confidence="high", confidence_score=0.9,
        axes=VariantAxes(0.9, 0.8, 0.85), reasoning="r",
    )
    return AgentResult(
        run_id="copy-test", variants=[v], trace="t", trace_structured=[],
        methodology="pas", model="dry-run", pipeline_version="v0",
        seed=None, created_at="2026-04-30T00:00:00Z",
    )


async def _stub_render_one(category, template_id, n_variants):
    item = RenderItem(
        category="meta-ads",
        relative_path="01-portfolio-grid.png",
        absolute_path=None,  # type: ignore[arg-type]
        width=1080, height=1080,
    )
    yield ("progress", {"file": item.relative_path, "status": "rendering", "url": None})
    yield ("progress", {"file": item.relative_path, "status": "ok",
                        "url": "/renders/01-portfolio-grid.png"})
    yield ("done", RenderReport(
        category="meta-ads", started_at="s", finished_at="f", duration_ms=10,
        results=[RenderResult(item=item, status="ok", bytes=1234)],
    ))


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_orchestrator_passes_model_to_planner(monkeypatch):
    """Reviewer N3: stream(model=...) was reaching agent_generate but not
    plan(). Verify the model passes through both calls."""
    captured: dict[str, Any] = {"plan_model": None, "agent_model": None}

    def _fake_plan(req, model):
        captured["plan_model"] = model
        return _stub_plan()

    def _fake_agent(brief, methodology, n, model):
        captured["agent_model"] = model
        return _stub_agent_result()

    monkeypatch.setattr(orchestrator, "plan", _fake_plan)
    monkeypatch.setattr(orchestrator, "agent_generate", _fake_agent)
    monkeypatch.setattr(orchestrator, "render_one", _stub_render_one)

    raw = ""
    async for chunk in orchestrator.stream(StudioRequest(prompt="x"), model="claude-opus-4-7"):
        raw += chunk
    assert captured["plan_model"] == "claude-opus-4-7"
    assert captured["agent_model"] == "claude-opus-4-7"


@pytest.mark.asyncio
async def test_orchestrator_emits_full_phase_sequence(monkeypatch):
    monkeypatch.setattr(orchestrator, "plan", lambda req, model=None: _stub_plan())
    monkeypatch.setattr(orchestrator, "agent_generate", lambda *a, **k: _stub_agent_result())
    monkeypatch.setattr(orchestrator, "render_one", _stub_render_one)

    raw = ""
    async for chunk in orchestrator.stream(StudioRequest(prompt="ad request")):
        raw += chunk

    events = _events(raw)
    names = [n for n, _ in events]

    # Phase markers in order
    assert names[0] == "run_start"
    assert names[-1] == "done"
    assert "plan_decided" in names

    starts = [d["node_id"] for n, d in events if n == "node_start"]
    assert starts == ["planning", "copy", "render"]

    dones = [d["node_id"] for n, d in events if n == "node_done"]
    assert dones == ["planning", "copy", "render"]


@pytest.mark.asyncio
async def test_orchestrator_emits_render_progress_per_file(monkeypatch):
    monkeypatch.setattr(orchestrator, "plan", lambda req, model=None: _stub_plan())
    monkeypatch.setattr(orchestrator, "agent_generate", lambda *a, **k: _stub_agent_result())
    monkeypatch.setattr(orchestrator, "render_one", _stub_render_one)

    raw = ""
    async for chunk in orchestrator.stream(StudioRequest(prompt="x")):
        raw += chunk
    events = _events(raw)

    progress = [d for n, d in events if n == "render_progress"]
    assert len(progress) == 2
    assert progress[0]["status"] == "rendering"
    assert progress[1]["status"] == "ok"
    assert progress[1]["url"] == "/renders/01-portfolio-grid.png"


@pytest.mark.asyncio
async def test_orchestrator_done_carries_plan_and_render_summary(monkeypatch):
    monkeypatch.setattr(orchestrator, "plan", lambda req, model=None: _stub_plan())
    monkeypatch.setattr(orchestrator, "agent_generate", lambda *a, **k: _stub_agent_result())
    monkeypatch.setattr(orchestrator, "render_one", _stub_render_one)

    raw = ""
    async for chunk in orchestrator.stream(StudioRequest(prompt="x")):
        raw += chunk
    events = _events(raw)
    done_payload = next(d for n, d in events if n == "done")

    assert done_payload["plan"]["category"] == "meta-ads"
    assert done_payload["plan"]["template_id"] == "01-portfolio-grid"
    assert done_payload["render"]["ok_count"] == 1
    assert done_payload["render"]["total"] == 1
    assert len(done_payload["variants"]) == 1


@pytest.mark.asyncio
async def test_orchestrator_emits_variant_done_during_copy_phase(monkeypatch):
    monkeypatch.setattr(orchestrator, "plan", lambda req, model=None: _stub_plan())
    monkeypatch.setattr(orchestrator, "agent_generate", lambda *a, **k: _stub_agent_result())
    monkeypatch.setattr(orchestrator, "render_one", _stub_render_one)

    raw = ""
    async for chunk in orchestrator.stream(StudioRequest(prompt="x")):
        raw += chunk
    events = _events(raw)
    names = [n for n, _ in events]

    # variant_done MUST land between copy node_start and copy node_done
    copy_start_idx = next(i for i, n in enumerate(names) if n == "node_start"
                          and events[i][1]["node_id"] == "copy")
    copy_done_idx = next(i for i, n in enumerate(names) if n == "node_done"
                         and events[i][1]["node_id"] == "copy")
    variant_done_idx = next(i for i, n in enumerate(names) if n == "variant_done")
    assert copy_start_idx < variant_done_idx < copy_done_idx


# ---------------------------------------------------------------------------
# Failure paths
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_orchestrator_emits_error_on_planner_failure(monkeypatch):
    def _boom(req, model=None):
        raise RuntimeError("planner exploded")
    monkeypatch.setattr(orchestrator, "plan", _boom)

    raw = ""
    async for chunk in orchestrator.stream(StudioRequest(prompt="x")):
        raw += chunk
    events = _events(raw)

    err = next(d for n, d in events if n == "error")
    assert err["code"] == "PLANNER_FAILED"
    assert "planner exploded" in err["error"]
    # Stream stops — no further node_start after error
    assert all(d["node_id"] != "copy" for n, d in events if n == "node_start")


@pytest.mark.asyncio
async def test_orchestrator_emits_error_on_copy_failure(monkeypatch):
    def _boom_copy(*a, **k):
        raise RuntimeError("agent.generate failed")

    monkeypatch.setattr(orchestrator, "plan", lambda req, model=None: _stub_plan())
    monkeypatch.setattr(orchestrator, "agent_generate", _boom_copy)
    monkeypatch.setattr(orchestrator, "render_one", _stub_render_one)

    raw = ""
    async for chunk in orchestrator.stream(StudioRequest(prompt="x")):
        raw += chunk
    events = _events(raw)
    err = next(d for n, d in events if n == "error")
    assert err["code"] == "COPY_FAILED"


@pytest.mark.asyncio
async def test_orchestrator_emits_error_on_render_failure(monkeypatch):
    monkeypatch.setattr(orchestrator, "plan", lambda req, model=None: _stub_plan())
    monkeypatch.setattr(orchestrator, "agent_generate", lambda *a, **k: _stub_agent_result())

    async def _boom_render(*a, **k):
        raise RuntimeError("playwright crashed")
        yield  # pragma: no cover — pretty unreachable

    monkeypatch.setattr(orchestrator, "render_one", _boom_render)

    raw = ""
    async for chunk in orchestrator.stream(StudioRequest(prompt="x")):
        raw += chunk
    events = _events(raw)
    err = next(d for n, d in events if n == "error")
    assert err["code"] == "RENDER_FAILED"


# ---------------------------------------------------------------------------
# render_one routing
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_render_one_meta_ads_filters_by_template_id(monkeypatch):
    """render_one must extract the leading id ('01') from the template_id
    ('01-portfolio-grid') when calling render_meta_ads."""
    captured: dict[str, Any] = {}

    async def _fake_render_meta_ads(ad_id=None):
        captured["ad_id"] = ad_id
        item = RenderItem("meta-ads", "01-portfolio-grid.png",
                          None, 1080, 1080)  # type: ignore[arg-type]
        return RenderReport(
            category="meta-ads", started_at="s", finished_at="f", duration_ms=10,
            results=[RenderResult(item=item, status="ok", bytes=10)],
        )

    monkeypatch.setattr(
        "features.web_gui.services.render_service.render_meta_ads",
        _fake_render_meta_ads,
    )
    out = []
    async for ev in orchestrator.render_one("meta-ads", "01-portfolio-grid", 3):
        out.append(ev)
    assert captured["ad_id"] == "01"
    assert any(kind == "done" for kind, _ in out)


@pytest.mark.asyncio
async def test_render_one_instagram_filters_by_stem(monkeypatch):
    captured: dict[str, Any] = {}

    async def _fake_render_instagram(stem=None):
        captured["stem"] = stem
        item = RenderItem("instagram", "single-manifesto.png",
                          None, 1080, 1350)  # type: ignore[arg-type]
        return RenderReport(
            category="instagram", started_at="s", finished_at="f", duration_ms=10,
            results=[RenderResult(item=item, status="ok", bytes=10)],
        )

    monkeypatch.setattr(
        "features.web_gui.services.render_service.render_instagram",
        _fake_render_instagram,
    )
    out = []
    async for ev in orchestrator.render_one("instagram", "single-manifesto", 3):
        out.append(ev)
    assert captured["stem"] == "single-manifesto"


@pytest.mark.asyncio
async def test_render_one_brand_pack_ignores_template_id(monkeypatch):
    called = {"n": 0}

    async def _fake_render_brand_pack():
        called["n"] += 1
        return RenderReport(
            category="brand-pack", started_at="s", finished_at="f", duration_ms=10,
            results=[],
        )

    monkeypatch.setattr(
        "features.web_gui.services.render_service.render_brand_pack",
        _fake_render_brand_pack,
    )
    async for _ in orchestrator.render_one("brand-pack", "anything", 3):
        pass
    assert called["n"] == 1
