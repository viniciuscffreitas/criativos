"""Unit tests for the SSE event generator (streaming.py).

Tests the generator directly — no HTTP layer involved.
"""
from __future__ import annotations

import json
import os

import pytest

from features.copy_generation.schema import Brief


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_brief() -> Brief:
    return Brief(
        product="Website Design",
        audience="Freelancers",
        pain="Too much time on admin",
        ctas=["Get started"],
    )


def _collect_events(gen) -> list[tuple[str, dict]]:
    """Parse raw SSE frames into (event_name, data_dict) pairs."""
    events: list[tuple[str, dict]] = []
    current_event: str | None = None
    for line in "".join(gen).splitlines():
        if line.startswith("event: "):
            current_event = line[len("event: "):]
        elif line.startswith("data: "):
            data = json.loads(line[len("data: "):])
            if current_event is not None:
                events.append((current_event, data))
            current_event = None
    return events


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_sse_format_contract():
    from features.copy_generation.streaming import sse
    result = sse("x", {"a": 1})
    assert result == 'event: x\ndata: {"a": 1}\n\n'


def test_dry_run_events_order(monkeypatch):
    monkeypatch.setenv("VIBEWEB_STREAM_TICK", "0")
    from features.copy_generation import streaming
    # Reload the module-level constant that was already evaluated at import.
    monkeypatch.setattr(streaming, "_STREAM_TICK_SECONDS", 0.0)

    from features.copy_generation.streaming import dry_run_events
    brief = _make_brief()
    events = _collect_events(dry_run_events(brief, "pas", 2))

    names = [e[0] for e in events]

    # First and last
    assert names[0] == "run_start"
    assert names[-1] == "done"

    # node_start(brief) before node_done(brief) before node_start(agent)
    brief_start_idx = names.index("node_start")
    brief_done_idx = names.index("node_done")
    # Second node_start is for agent
    agent_start_idx = names.index("node_start", brief_start_idx + 1)
    assert brief_start_idx < brief_done_idx < agent_start_idx

    # At least one token event
    assert "token" in names

    # variant_done × N (N=2)
    assert names.count("variant_done") == 2

    # node_done(agent) before done
    last_node_done_idx = len(names) - 1 - names[::-1].index("node_done")
    done_idx = names.index("done")
    assert last_node_done_idx < done_idx


def test_dry_run_events_unicode_preserved(monkeypatch):
    monkeypatch.setenv("VIBEWEB_STREAM_TICK", "0")
    from features.copy_generation import streaming
    monkeypatch.setattr(streaming, "_STREAM_TICK_SECONDS", 0.0)

    from features.copy_generation.streaming import dry_run_events
    brief = Brief(
        product="Produto incrível",
        audience="Empreendedores",
        pain="Dificuldades com ação de marketing",
        ctas=["Saiba mais"],
    )
    raw = "".join(dry_run_events(brief, "pas", 1))
    # ensure_ascii=False must preserve literal unicode — "ação" must NOT be escaped
    assert "ação" in raw


def test_dry_run_events_n_variants_matches_input(monkeypatch):
    monkeypatch.setenv("VIBEWEB_STREAM_TICK", "0")
    from features.copy_generation import streaming
    monkeypatch.setattr(streaming, "_STREAM_TICK_SECONDS", 0.0)

    from features.copy_generation.streaming import dry_run_events
    brief = _make_brief()
    events = _collect_events(dry_run_events(brief, "pas", 3))
    names = [e[0] for e in events]
    assert names.count("variant_done") == 3
