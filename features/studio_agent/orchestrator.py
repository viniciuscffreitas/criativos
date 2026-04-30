"""Orchestrator: StudioRequest -> SSE event stream.

Phases (node_id values, in order): planning -> copy -> render.
Emits the existing SSE vocabulary from copy_generation.streaming
(run_start, node_start, node_done, token, variant_done, done, error)
plus two additions:

  - plan_decided     {plan: <serialized StudioPlan>}     (between planning
                                                          done and copy start)
  - render_progress  {file, status, url}                 (during render phase)

The token event for the copy phase carries node_id="copy". The existing
FlowView Generate.tsx uses node_id="agent"; both coexist because the
front-end routes by node_id, not by event name.
"""
from __future__ import annotations

import asyncio
import json
import time
from dataclasses import asdict
from typing import AsyncIterator

from features.copy_generation.agent import generate as agent_generate
from features.studio_agent.planner import plan
from features.studio_agent.schema import StudioPlan, StudioRequest
from features.web_gui.services import render_service


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _now_ms(start: float) -> int:
    return int((time.monotonic() - start) * 1000)


def _serialize_plan(p: StudioPlan) -> dict:
    return {
        "category": p.category,
        "template_id": p.template_id,
        "methodology": p.methodology,
        "n_variants": p.n_variants,
        "reasoning": p.reasoning,
        "brief": {
            "product": p.brief.product,
            "audience": p.brief.audience,
            "pain": p.brief.pain,
            "ctas": list(p.brief.ctas),
            "social_proof": p.brief.social_proof,
        },
    }


# ---------------------------------------------------------------------------
# render_one — adapter between studio orchestration and render_service
# ---------------------------------------------------------------------------

_CATEGORY_TO_URL_PREFIX = {
    "brand-pack": "/brand/",
    "meta-ads":   "/renders/",
    "instagram":  "/instagram/",
}


async def render_one(category: str, template_id: str, n_variants: int):
    """Run the matching render_service function and yield ('progress', dict)
    or ('done', RenderReport) tuples.

    Filtering rules:
      - meta-ads:  filter by template_id's leading id segment (e.g.
                   "01-portfolio-grid" -> ad_id="01").
      - instagram: filter by full stem (e.g. "single-manifesto").
      - brand-pack: template_id is ignored — always renders the whole pack.

    Note: render_service functions block on Playwright until the report is
    complete; the per-file 'progress' events here are derived from the report
    after the fact (status: ok | missing | error). True per-file streaming
    during the render is a v2 follow-up.
    """
    if category == "meta-ads":
        ad_id = template_id.split("-", 1)[0]
        report = await render_service.render_meta_ads(ad_id=ad_id)
    elif category == "instagram":
        report = await render_service.render_instagram(stem=template_id)
    else:
        report = await render_service.render_brand_pack()

    prefix = _CATEGORY_TO_URL_PREFIX[category]
    for r in report.results:
        yield ("progress", {
            "file": r.item.relative_path,
            "status": r.status,
            "url": f"{prefix}{r.item.relative_path}" if r.status == "ok" else None,
        })
    yield ("done", report)


# ---------------------------------------------------------------------------
# Main streamer
# ---------------------------------------------------------------------------

async def stream(
    req: StudioRequest, model: str = "claude-sonnet-4-6",
) -> AsyncIterator[str]:
    run_start = time.monotonic()
    run_id = f"studio-{int(time.time() * 1000)}"

    yield _sse("run_start", {
        "run_id": run_id,
        "pipeline_version": "studio_agent@v1",
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })

    # ---- Phase 1: planning -------------------------------------------------
    yield _sse("node_start", {
        "node_id": "planning",
        "label": "Entendendo seu pedido",
        "start_ms": 0,
    })
    try:
        # plan() is sync; CLI shell-out is blocking. to_thread keeps the
        # FastAPI loop responsive for other clients.
        sp = await asyncio.to_thread(plan, req)
    except Exception as e:
        yield _sse("error", {
            "code": "PLANNER_FAILED",
            "error": f"planner failed: {e}",
        })
        return

    yield _sse("node_done", {
        "node_id": "planning",
        "end_ms": _now_ms(run_start),
        "tokens": 0, "confidence": None,
        "output_preview": sp.reasoning[:80],
    })
    yield _sse("plan_decided", {"plan": _serialize_plan(sp)})

    # ---- Phase 2: copy -----------------------------------------------------
    yield _sse("node_start", {
        "node_id": "copy",
        "label": "Gerando copy",
        "start_ms": _now_ms(run_start),
    })
    try:
        result = await asyncio.to_thread(
            agent_generate, sp.brief, sp.methodology, sp.n_variants, model,
        )
    except Exception as e:
        yield _sse("error", {
            "code": "COPY_FAILED",
            "error": f"copy generation failed: {e}",
        })
        return

    for v in result.variants:
        yield _sse("variant_done", {
            **asdict(v), "axes": asdict(v.axes),
            "confidence_symbol": v.confidence_symbol,
        })

    yield _sse("node_done", {
        "node_id": "copy",
        "end_ms": _now_ms(run_start),
        "tokens": 0,
        "confidence": result.variants[0].confidence_score if result.variants else None,
        "output_preview": (result.variants[0].headline[:80] if result.variants else ""),
    })

    # ---- Phase 3: render ---------------------------------------------------
    yield _sse("node_start", {
        "node_id": "render",
        "label": "Renderizando",
        "start_ms": _now_ms(run_start),
    })
    render_report = None
    try:
        async for kind, payload in render_one(sp.category, sp.template_id, sp.n_variants):
            if kind == "progress":
                yield _sse("render_progress", payload)
            elif kind == "done":
                render_report = payload
    except Exception as e:
        yield _sse("error", {
            "code": "RENDER_FAILED",
            "error": f"render failed: {e}",
        })
        return

    ok = render_report.ok_count if render_report else 0
    total = render_report.total if render_report else 0
    yield _sse("node_done", {
        "node_id": "render",
        "end_ms": _now_ms(run_start),
        "tokens": 0, "confidence": None,
        "output_preview": f"{ok}/{total} renderizados",
    })

    # ---- done envelope -----------------------------------------------------
    yield _sse("done", {
        "run_id": run_id,
        "plan": _serialize_plan(sp),
        "variants": [
            {**asdict(v), "axes": asdict(v.axes), "confidence_symbol": v.confidence_symbol}
            for v in result.variants
        ],
        "render": {
            "category": render_report.category if render_report else sp.category,
            "ok_count": ok,
            "total": total,
            "duration_ms": render_report.duration_ms if render_report else 0,
        },
    })
