"""
SSE event generator with dry-run parity.

The UI code path is identical between dry-run and real mode — backend forks.
In dry-run we synthesize token events from the deterministic stub variants.
Real mode (Task 9b follow-up) will consume anthropic.messages.stream().text_stream
and emit the same events.
"""
from __future__ import annotations

import json
import os
import time
from dataclasses import asdict
from typing import Iterator

from features.copy_generation.agent import _dry_run_variants
from features.copy_generation.schema import Brief


# Override with VIBEWEB_STREAM_TICK=0 in tests to avoid sleep overhead.
_STREAM_TICK_SECONDS = float(os.getenv("VIBEWEB_STREAM_TICK", "0.02"))
_TOKEN_CHUNK_CHARS = 4


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _chunks(s: str, n: int) -> Iterator[str]:
    for i in range(0, len(s), n):
        yield s[i : i + n]


def _serialize_result(result) -> dict:
    return {
        "run_id": result.run_id,
        "variants": [
            {**asdict(v), "axes": asdict(v.axes), "confidence_symbol": v.confidence_symbol}
            for v in result.variants
        ],
        "trace": result.trace,
        "trace_structured": [asdict(t) for t in result.trace_structured],
        "methodology": result.methodology,
        "model": result.model,
        "pipeline_version": result.pipeline_version,
        "seed": result.seed,
        "created_at": result.created_at,
    }


def dry_run_events(brief: Brief, methodology_name: str, n: int) -> Iterator[str]:
    """Yield SSE frames for a dry-run generation. Deterministic except for run_id."""
    result = _dry_run_variants(brief, methodology_name, n)
    run_start = time.monotonic()

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
        for chunk in _chunks(v.headline, _TOKEN_CHUNK_CHARS):
            yield sse("token", {"node_id": "agent", "variant_id": v.id, "text": chunk})
            if _STREAM_TICK_SECONDS > 0:
                time.sleep(_STREAM_TICK_SECONDS)
        yield sse("variant_done", {
            **asdict(v), "axes": asdict(v.axes), "confidence_symbol": v.confidence_symbol,
        })

    end_ms = int((time.monotonic() - run_start) * 1000)
    yield sse("node_done", {
        "node_id": "agent", "end_ms": end_ms, "tokens": 120,
        "confidence": 0.7, "output_preview": "dry-run",
    })
    yield sse("done", _serialize_result(result))
