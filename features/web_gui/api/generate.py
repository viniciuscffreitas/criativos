"""
Generate routes — POST /api/v1/generate and POST /api/v1/generate/stream.

Resolves project + ad, builds a Brief, calls agent.generate(), persists
variants + trace metadata to ads.yaml (when persist=True), and ALWAYS saves
the full trace JSON via trace_store.

Routes:
  POST /api/v1/generate
  POST /api/v1/generate/stream
"""
from __future__ import annotations

import time
from dataclasses import asdict
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from features.copy_generation import agent
from features.copy_generation.schema import Brief
from features.copy_generation.streaming import dry_run_events, sse, _serialize_result
from features.web_gui.api._helpers import find_ad_key, resolve_ads_path
from features.web_gui.services import trace_store, yaml_rw

router = APIRouter(tags=["generate"])

# Lists methodologies whose prompts + parsers are fully wired. Registered-but-stubbed
# ones (e.g. NPQEL) live in copy_generation/methodologies/__init__.py but raise
# NotImplementedError; this gate converts those to 501 before the agent is invoked.
# Keep in sync with the registry when a methodology graduates from stub to live.
IMPLEMENTED_METHODOLOGIES: frozenset[str] = frozenset({"pas"})


class GenerateIn(BaseModel):
    project_slug: str
    ad_id: str
    methodology: str
    n_variants: int = 3
    brief_overrides: dict | None = None
    persist: bool = True


class _AdNotFound(Exception):
    """Raised inside a yaml_rw.modify callback when the target ad_id is missing.
    Caller translates to HTTPException 404 — keeps yaml_rw HTTP-agnostic."""


def _resolve_brief(payload: GenerateIn) -> tuple[Path, str, Brief]:
    """Resolve ads_path, ad key, and constructed Brief. Raises HTTPException on invalid input."""
    ads_path = resolve_ads_path(payload.project_slug)
    try:
        ads_data = yaml_rw.read(ads_path)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": f"ads file not found: {ads_path}", "code": "ADS_FILE_NOT_FOUND"},
        ) from exc
    key = find_ad_key(ads_data, payload.ad_id)
    raw_brief = ads_data["ads"][key].get("brief")
    if raw_brief is None:
        raise HTTPException(
            status_code=404,
            detail={"error": f"ad {payload.ad_id!r} has no brief", "code": "BRIEF_NOT_FOUND"},
        )
    if payload.brief_overrides:
        raw_brief = {**raw_brief, **payload.brief_overrides}
    try:
        brief = Brief(
            product=raw_brief["product"],
            audience=raw_brief["audience"],
            pain=raw_brief["pain"],
            ctas=raw_brief.get("ctas") or [],
            social_proof=raw_brief.get("social_proof"),
        )
    except KeyError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "error": f"brief missing required field: {exc.args[0]!r}",
                "code": "BRIEF_INVALID",
                "raw": str(exc),
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": str(exc), "code": "BRIEF_INVALID", "raw": str(exc)},
        ) from exc
    return ads_path, key, brief


@router.post("/generate")
def post_generate(payload: GenerateIn):
    # 1. Check methodology is implemented before any I/O.
    if payload.methodology not in IMPLEMENTED_METHODOLOGIES:
        raise HTTPException(
            status_code=501,
            detail={
                "error": (
                    f"methodology {payload.methodology!r} is not implemented; "
                    f"available: {sorted(IMPLEMENTED_METHODOLOGIES)}"
                ),
                "code": "METHODOLOGY_NOT_IMPLEMENTED",
            },
        )

    # 2–5. Resolve project, ad, brief via shared helper.
    ads_path, key, brief = _resolve_brief(payload)

    # 6. Call the agent. NotImplementedError surfaces for stubs like NPQEL
    # even though we gate at step 1 — leave as an unhandled 500 for anything
    # that slips through (defensive). KeyError for unknown methodology is
    # already handled above, so this path is unreachable in normal flow.
    result = agent.generate(brief, methodology=payload.methodology, n=payload.n_variants)

    # 7. Serialize variants.
    serialized_variants = [
        {**asdict(v), "axes": asdict(v.axes), "confidence_symbol": v.confidence_symbol}
        for v in result.variants
    ]
    serialized = {
        "run_id": result.run_id,
        "variants": serialized_variants,
        "trace": result.trace,
        "trace_structured": [asdict(t) for t in result.trace_structured],
        "methodology": result.methodology,
        "model": result.model,
        "pipeline_version": result.pipeline_version,
        "seed": result.seed,
        "created_at": result.created_at,
    }

    # 8. Save trace ALWAYS (regardless of persist flag).
    trace_store.save(result.run_id, serialized)

    # 9. Persist variants + trace metadata to ads.yaml when requested.
    if payload.persist:
        def _mutate(data: dict) -> dict:
            for k, ad_entry in data.get("ads", {}).items():
                if ad_entry.get("id") == payload.ad_id:
                    data["ads"][k]["variants"] = serialized_variants
                    if "trace" not in data["ads"][k]:
                        data["ads"][k]["trace"] = {}
                    data["ads"][k]["trace"]["last_run"] = result.run_id
                    data["ads"][k]["trace"]["confidence"] = (
                        result.variants[0].confidence_score if result.variants else None
                    )
                    return data
            raise _AdNotFound(payload.ad_id)

        try:
            yaml_rw.modify(ads_path, _mutate)
        except _AdNotFound as exc:
            raise HTTPException(
                status_code=404,
                detail={"error": f"ad {str(exc)!r} not found in project", "code": "AD_NOT_FOUND"},
            ) from exc

    # 10. Return serialized result.
    return serialized


@router.post("/generate/stream")
def post_generate_stream(payload: GenerateIn):
    # 1. Methodology gate BEFORE any I/O.
    if payload.methodology not in IMPLEMENTED_METHODOLOGIES:
        raise HTTPException(
            status_code=501,
            detail={
                "error": (
                    f"methodology {payload.methodology!r} is not implemented; "
                    f"available: {sorted(IMPLEMENTED_METHODOLOGIES)}"
                ),
                "code": "METHODOLOGY_NOT_IMPLEMENTED",
            },
        )
    # 2. Resolve project, ad, brief — raises HTTPException synchronously if invalid.
    # ads_path + key only needed for persist=True; streaming route doesn't support persistence yet.
    _, _, brief = _resolve_brief(payload)

    # 3. Dispatch to dry-run generator. Real streaming = Task 9b follow-up.
    if not agent._is_dry_run():
        # For now, non-dry-run streaming replays from a single non-streaming call.
        # This keeps the UI contract stable; real token streaming lands in Task 9b.
        return StreamingResponse(
            _replay_events(brief, payload),
            media_type="text/event-stream",
        )
    return StreamingResponse(
        dry_run_events(brief, payload.methodology, payload.n_variants),
        media_type="text/event-stream",
    )


def _replay_events(brief: Brief, payload: GenerateIn):
    """Non-dry-run streaming placeholder: one non-streaming call, replay as events.

    Task 9b will replace this with anthropic.messages.stream().text_stream consumption.
    """
    run_start = time.monotonic()
    result = agent.generate(brief, methodology=payload.methodology, n=payload.n_variants)
    yield sse("run_start", {
        "run_id": result.run_id,
        "pipeline_version": result.pipeline_version,
        "started_at": result.created_at,
    })
    yield sse("node_start", {"node_id": "brief", "label": "Briefing", "start_ms": 0})
    yield sse("node_done", {
        "node_id": "brief", "end_ms": 20, "tokens": 0,
        "confidence": None, "output_preview": brief.pain[:80],
    })
    yield sse("node_start", {"node_id": "agent", "label": "Agente criativo", "start_ms": 20})
    for v in result.variants:
        yield sse("variant_done", {
            **asdict(v), "axes": asdict(v.axes), "confidence_symbol": v.confidence_symbol,
        })
    # Token/confidence come from agent.trace_structured; populated by Task 9b.
    yield sse("node_done", {
        "node_id": "agent",
        "end_ms": int((time.monotonic() - run_start) * 1000),
        "tokens": sum(t.tokens for t in result.trace_structured) if result.trace_structured else 0,
        "confidence": next((t.confidence for t in result.trace_structured if t.id == "agent"), None),
        "output_preview": result.variants[0].headline[:80] if result.variants else "",
    })
    yield sse("done", _serialize_result(result))
