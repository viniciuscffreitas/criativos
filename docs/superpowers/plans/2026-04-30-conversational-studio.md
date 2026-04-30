# Conversational Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current button-driven Studio with a conversational
input ("eu peço X em linguagem natural → Claude decide tudo → assets aparecem
em tempo real"). The user types a free-form prompt, an agent picks the
category/template/methodology/brief, copy is generated, the asset is rendered,
and progress streams live to the UI — same shape and aesthetic as the existing
`Generate.tsx` token-streaming visualization, plus per-asset render progress.

**Architecture:** New `features/studio_agent/` vertical slice runs a one-shot
Claude call (or deterministic stub in dry-run) that returns a `StudioPlan`
(category, template_id, methodology, brief, n_variants, reasoning). A new
`features/studio_agent/orchestrator.py` chains three phases — **plan → copy →
render** — emitting the existing SSE event vocabulary plus two new events
(`plan_decided`, `render_progress`) so the React Studio can show live progress
across all phases. The current button-driven Studio stays as a fallback for
"render every asset in this category" — the conversational input is additive,
not replacing.

**Tech Stack:** Python 3.13 + FastAPI + `claude` CLI shell-out (existing
pattern in `copy_generation.agent`); React 18 + TypeScript + the existing SSE
parser in `streamGenerate`.

---

## Out of scope (deferred — drafted as tech debt)

- **Refactor 32 hardcoded templates** (6 IG singles + 21 carousel slides + 5
  brand templates) so their copy is parameterizable. Without this, the agent
  can only freshly generate copy for the 26 already-parameterized outputs
  (6 Meta Ads + 5 highlight types + 15 story slots). For the hardcoded
  templates the agent will still pick "render single-manifesto" (re-render
  with the existing baked-in copy) — useful, but not "new copy from prompt."
  Drafted as Linear ticket below.
- **Per-asset re-render UI** in the AssetCard (action button on hover) —
  Task 7 includes the hover overlay slot, action wiring is v2.
- **Multi-asset planning** ("gera 3 carousels diferentes") — agent emits one
  plan per request in v1.
- **Editing variant copy then regenerating** — v1 picks variant 0 automatically.

---

## File structure

**Created (backend)**
- `features/studio_agent/__init__.py`
- `features/studio_agent/schema.py` — `StudioRequest`, `StudioPlan`, validation
- `features/studio_agent/planner.py` — `plan(prompt, dry_run=auto) → StudioPlan`; dry-run synth + real CLI shell
- `features/studio_agent/orchestrator.py` — `async stream(req) → AsyncIterator[str]`; assembles plan→copy→render with SSE
- `features/studio_agent/test_schema.py`
- `features/studio_agent/test_planner.py`
- `features/studio_agent/test_orchestrator.py`
- `features/studio_agent/CLAUDE.md` — feature-specific context
- `features/web_gui/api/studio.py` — POST `/api/v1/studio/request` SSE
- `features/web_gui/api/test_studio.py`

**Modified (backend)**
- `features/web_gui/server.py` — register router

**Created (frontend)**
- `features/web_gui/ui/src/components/ConversationalPrompt.tsx` — input box
- `features/web_gui/ui/src/components/StudioStream.tsx` — token stream + node graph (copies pattern from `Generate.tsx`)
- `features/web_gui/ui/src/components/AssetCardRich.tsx` — hover state + tooltip + actions overlay
- All three with co-located `*.test.tsx`

**Modified (frontend)**
- `features/web_gui/ui/src/components/Studio.tsx` — add prompt at top + stream below + grid uses AssetCardRich; "Gerar [cat]" buttons stay as fallback
- `features/web_gui/ui/src/api.ts` — add `streamStudioRequest()` method
- `features/web_gui/ui/src/types.ts` — `StudioPlan`, `StudioStreamEvent`, `RenderProgressEvent`
- `features/web_gui/ui/src/components/Studio.test.tsx` — extend for prompt + stream

---

## Task 1: StudioRequest / StudioPlan schema

**Files:**
- Create: `features/studio_agent/__init__.py` (empty)
- Create: `features/studio_agent/schema.py`
- Create: `features/studio_agent/test_schema.py`

- [ ] **Step 1: RED — write failing schema tests**

```python
# features/studio_agent/test_schema.py
import pytest
from features.studio_agent.schema import StudioRequest, StudioPlan


def test_studio_request_requires_non_empty_prompt():
    with pytest.raises(ValueError, match="prompt"):
        StudioRequest(prompt="")
    with pytest.raises(ValueError, match="prompt"):
        StudioRequest(prompt="   ")


def test_studio_request_accepts_n_variants_default_3():
    r = StudioRequest(prompt="post about new service")
    assert r.n_variants == 3


def test_studio_plan_normalises_methodology_lowercase():
    from features.copy_generation.schema import Brief
    plan = StudioPlan(
        category="meta-ads", template_id="01-portfolio-grid",
        methodology="PAS",
        brief=Brief(product="p", audience="a", pain="x", ctas=["go"]),
        n_variants=3, reasoning="r",
    )
    assert plan.methodology == "pas"


def test_studio_plan_rejects_unknown_category():
    from features.copy_generation.schema import Brief
    with pytest.raises(ValueError, match="category"):
        StudioPlan(
            category="bogus", template_id="x", methodology="pas",
            brief=Brief(product="p", audience="a", pain="x", ctas=["go"]),
            n_variants=3, reasoning="r",
        )


def test_studio_plan_rejects_unknown_methodology():
    from features.copy_generation.schema import Brief
    with pytest.raises(ValueError, match="methodology"):
        StudioPlan(
            category="meta-ads", template_id="01-portfolio-grid",
            methodology="ghost",
            brief=Brief(product="p", audience="a", pain="x", ctas=["go"]),
            n_variants=3, reasoning="r",
        )
```

- [ ] **Step 2: Run — must FAIL** (`pytest features/studio_agent/test_schema.py -v`).

- [ ] **Step 3: GREEN — implement**

```python
# features/studio_agent/schema.py
"""Schema for studio_agent: a conversational layer on top of copy_generation
+ render_service.

A user prompt → StudioPlan (category + template + methodology + brief + n).
The orchestrator then runs the plan: copy gen → render. v1 produces ONE plan
per request; multi-asset planning lands in v2.
"""
from __future__ import annotations

from dataclasses import dataclass

from features.copy_generation.schema import Brief

_VALID_CATEGORIES = frozenset({
    "brand-pack", "meta-ads", "instagram",
})

_VALID_METHODOLOGIES = frozenset({"pas", "aida", "bab"})


@dataclass
class StudioRequest:
    """User-facing request — one prompt, optional knobs."""
    prompt: str
    n_variants: int = 3

    def __post_init__(self) -> None:
        if not self.prompt or not self.prompt.strip():
            raise ValueError(
                "StudioRequest.prompt cannot be empty or whitespace-only"
            )
        if not (1 <= self.n_variants <= 8):
            raise ValueError(
                f"StudioRequest.n_variants must be in [1,8]; got {self.n_variants}"
            )


@dataclass
class StudioPlan:
    """Agent decision: which asset to produce + with which copy."""
    category: str            # one of _VALID_CATEGORIES
    template_id: str         # e.g. "01-portfolio-grid" or "single-manifesto"
    methodology: str         # one of _VALID_METHODOLOGIES (lowercased)
    brief: Brief             # copy_generation Brief
    n_variants: int
    reasoning: str           # short rationale shown in trace

    def __post_init__(self) -> None:
        self.methodology = self.methodology.lower()
        if self.category not in _VALID_CATEGORIES:
            raise ValueError(
                f"StudioPlan.category {self.category!r} not in {sorted(_VALID_CATEGORIES)}"
            )
        if self.methodology not in _VALID_METHODOLOGIES:
            raise ValueError(
                f"StudioPlan.methodology {self.methodology!r} not in "
                f"{sorted(_VALID_METHODOLOGIES)}"
            )
        if not (1 <= self.n_variants <= 8):
            raise ValueError(
                f"StudioPlan.n_variants must be in [1,8]; got {self.n_variants}"
            )
```

- [ ] **Step 4: Run — PASS**.

- [ ] **Step 5: Commit**

```bash
git add features/studio_agent/__init__.py features/studio_agent/schema.py features/studio_agent/test_schema.py
git commit -m "feat(studio_agent): StudioRequest/StudioPlan schema with validation"
```

---

## Task 2: planner — dry-run keyword routing + real-mode CLI

**Files:**
- Create: `features/studio_agent/planner.py`
- Create: `features/studio_agent/test_planner.py`

- [ ] **Step 1: RED — failing tests for dry-run keyword routing**

```python
# features/studio_agent/test_planner.py
import pytest
from features.studio_agent.planner import plan, _is_dry_run
from features.studio_agent.schema import StudioRequest


def test_dry_run_meta_ads_keyword(monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    p = plan(StudioRequest(prompt="quero um anúncio Meta sobre meu serviço de site"))
    assert p.category == "meta-ads"
    assert p.template_id.startswith(("01-", "02-", "03-", "04-", "05-", "06-"))
    assert p.methodology in {"pas", "aida", "bab"}
    assert p.brief.ctas  # never empty


def test_dry_run_instagram_keyword(monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    p = plan(StudioRequest(prompt="post Instagram sobre lançamento"))
    assert p.category == "instagram"
    assert p.template_id  # any valid IG stem


def test_dry_run_brand_keyword(monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    p = plan(StudioRequest(prompt="logo + favicons da marca"))
    assert p.category == "brand-pack"


def test_dry_run_default_to_meta_ads_when_ambiguous(monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    p = plan(StudioRequest(prompt="gera algo legal"))
    # Stable default for ambiguous prompts — meta-ads (the historical primary)
    assert p.category == "meta-ads"


def test_real_mode_calls_cli(monkeypatch):
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-fake")

    captured = {"called": 0}

    def _fake_run_cli(prompt, system_prompt, model):
        captured["called"] += 1
        captured["prompt"] = prompt
        # Return a JSON response shaped like the real envelope
        return {
            "category": "meta-ads",
            "template_id": "01-portfolio-grid",
            "methodology": "pas",
            "brief": {
                "product": "Custom websites",
                "audience": "freelancers",
                "pain": "no website",
                "ctas": ["Message me"],
                "social_proof": None,
            },
            "n_variants": 3,
            "reasoning": "user wants meta ad",
        }

    import features.studio_agent.planner as _p
    monkeypatch.setattr(_p, "_run_cli", _fake_run_cli)

    p = plan(StudioRequest(prompt="quero um anúncio"))
    assert captured["called"] == 1
    assert p.category == "meta-ads"
    assert p.brief.product == "Custom websites"


def test_real_mode_malformed_json_raises(monkeypatch):
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-fake")

    def _fake_run_cli(prompt, system_prompt, model):
        return "not valid json"

    import features.studio_agent.planner as _p
    monkeypatch.setattr(_p, "_run_cli", _fake_run_cli)

    with pytest.raises(RuntimeError, match="planner CLI returned"):
        plan(StudioRequest(prompt="x"))


def test_dry_run_default_when_no_auth(monkeypatch):
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)
    monkeypatch.delenv("CLAUDE_CODE_OAUTH_TOKEN", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert _is_dry_run() is True
```

- [ ] **Step 2: Run — FAIL**.

- [ ] **Step 3: GREEN — implement**

```python
# features/studio_agent/planner.py
"""Planner: prompt → StudioPlan.

Dry-run mode (default in tests / when no auth is set): deterministic keyword
routing. Real mode: shells out to `claude -p` with a system prompt that
forces JSON output matching the StudioPlan schema.

Why a separate _run_cli (not reuse copy_generation.agent._run_cli): the
prompt + system + parser shape differ. Per CLAUDE.md §2.3 (DAMP > DRY at
two duplications), the second occurrence is OK; we'll extract on the third.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from typing import Any

from features.copy_generation.schema import Brief
from features.studio_agent.schema import StudioPlan, StudioRequest

_DEFAULT_MODEL = "claude-sonnet-4-6"

_SYSTEM_PROMPT = """You route creative requests to the Vibe Web pipeline.

Output ONLY valid JSON (no prose, no markdown fence) matching this schema:

{
  "category": "brand-pack" | "meta-ads" | "instagram",
  "template_id": string,         // see catalog below
  "methodology": "pas" | "aida" | "bab",
  "brief": {
    "product": string,
    "audience": string,
    "pain": string,
    "ctas": [string, ...],       // at least one
    "social_proof": string | null
  },
  "n_variants": integer (1-8),
  "reasoning": string             // one short sentence
}

Template catalog (template_id):
- meta-ads: 01-portfolio-grid | 02-before-after | 03-social-proof | 04-price-objection | 05-mockup-showcase | 06-niche-designers
- instagram: single-manifesto | single-cost-of-inaction | single-niche-tag | single-proof-number | single-offer-mechanics | single-cta-pure | carousel-portfolio | carousel-services | carousel-process | highlight-cover | story-starter | account-avatar
- brand-pack: brand   (the only template_id; renders the full pack)

Choose a methodology that matches the request's emotional arc:
- pas: Problem → Agitate → Solve (fear-based, for objections)
- aida: Attention → Interest → Desire → Action (educational)
- bab: Before → After → Bridge (transformation stories)

When the user is vague, default to category=meta-ads, template_id=01-portfolio-grid,
methodology=pas. Never refuse — always emit a valid plan.
"""


def _is_dry_run() -> bool:
    if os.getenv("VIBEWEB_DRY_RUN") == "1":
        return True
    has_token = bool(os.getenv("CLAUDE_CODE_OAUTH_TOKEN") or os.getenv("ANTHROPIC_API_KEY"))
    return not has_token


def _build_cli_env() -> dict[str, str]:
    env = os.environ.copy()
    for k in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"):
        if k in env and not env[k].strip():
            env.pop(k)
    return env


def _run_cli(prompt: str, system_prompt: str, model: str) -> Any:
    cli = shutil.which("claude")
    if not cli:
        raise RuntimeError(
            "claude CLI not on PATH; install via 'npm i -g @anthropic-ai/claude-code'"
        )
    proc = subprocess.run(
        [cli, "-p", prompt, "--append-system-prompt", system_prompt,
         "--output-format", "json", "--model", model],
        env=_build_cli_env(),
        check=False, capture_output=True, text=True, timeout=120,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"claude CLI exited {proc.returncode}: stderr={proc.stderr[:500]!r}"
        )
    try:
        envelope = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"claude CLI returned non-JSON envelope: {proc.stdout[:500]!r}"
        ) from e
    if envelope.get("is_error"):
        raise RuntimeError(f"claude CLI envelope marked error: {envelope!r}")
    result_str = envelope.get("result", "")
    try:
        return json.loads(result_str)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"planner CLI returned non-JSON result body: {result_str[:500]!r}"
        ) from e


# Keyword → category routing for dry-run deterministic synthesis
_CATEGORY_KEYWORDS = [
    ("brand-pack", ("logo", "favicon", "marca", "logos", "logotipo", "wordmark")),
    ("instagram",  ("instagram", "ig", "post", "carrossel", "carousel", "story", "stories", "highlight")),
    ("meta-ads",   ("anúnci", "anunci", "ad", "ads", "facebook", "meta")),
]

_DEFAULT_TEMPLATES = {
    "brand-pack": "brand",
    "meta-ads": "01-portfolio-grid",
    "instagram": "single-manifesto",
}


def _dry_run_plan(req: StudioRequest) -> StudioPlan:
    p = req.prompt.lower()
    category = "meta-ads"  # default
    for cat, kws in _CATEGORY_KEYWORDS:
        if any(kw in p for kw in kws):
            category = cat
            break

    return StudioPlan(
        category=category,
        template_id=_DEFAULT_TEMPLATES[category],
        methodology="pas",
        brief=Brief(
            product=(req.prompt[:80] or "produto"),
            audience="audiência inferida",
            pain="dor inferida",
            ctas=["Saiba mais"],
            social_proof=None,
        ),
        n_variants=req.n_variants,
        reasoning=f"dry-run keyword route → {category}",
    )


def plan(req: StudioRequest, model: str = _DEFAULT_MODEL) -> StudioPlan:
    if _is_dry_run():
        return _dry_run_plan(req)

    raw = _run_cli(req.prompt, _SYSTEM_PROMPT, model)
    if not isinstance(raw, dict):
        raise RuntimeError(f"planner CLI returned non-dict body: {raw!r}")
    try:
        brief_d = raw["brief"]
        brief = Brief(
            product=brief_d["product"],
            audience=brief_d["audience"],
            pain=brief_d["pain"],
            ctas=list(brief_d.get("ctas") or []),
            social_proof=brief_d.get("social_proof"),
        )
        return StudioPlan(
            category=raw["category"],
            template_id=raw["template_id"],
            methodology=raw["methodology"],
            brief=brief,
            n_variants=int(raw.get("n_variants", req.n_variants)),
            reasoning=raw.get("reasoning", ""),
        )
    except (KeyError, TypeError, ValueError) as e:
        raise RuntimeError(
            f"planner CLI returned malformed plan: {raw!r}"
        ) from e
```

- [ ] **Step 4: Run — PASS** (`pytest features/studio_agent/test_planner.py -v`).

- [ ] **Step 5: Commit**

```bash
git add features/studio_agent/planner.py features/studio_agent/test_planner.py
git commit -m "feat(studio_agent): planner with dry-run keyword routing + real CLI shell"
```

---

## Task 3: orchestrator — SSE assembly of plan → copy → render

**Files:**
- Create: `features/studio_agent/orchestrator.py`
- Create: `features/studio_agent/test_orchestrator.py`

The orchestrator emits the existing SSE vocabulary (`run_start`, `node_start`,
`node_done`, `token`, `variant_done`, `done`, `error`) plus two new events:
- `plan_decided` `{plan: <serialized StudioPlan>}` — fired between
  `node_done(planning)` and `node_start(copy)`.
- `render_progress` `{file, status, url?}` — fired during the render node.

Phases (node_id values in order): `planning` → `copy` → `render`. The token
event for the copy phase carries `node_id="copy"` (not `"agent"` as in the
existing copy_generation streamer) — the React Studio ties the token panel to
node_id, so changing the label doesn't break the existing FlowView.

- [ ] **Step 1: RED — failing test for happy-path event ordering**

```python
# features/studio_agent/test_orchestrator.py
import asyncio
import json
import pytest

from features.studio_agent import orchestrator
from features.studio_agent.schema import StudioRequest, StudioPlan
from features.copy_generation.schema import Brief, CopyVariant, VariantAxes, AgentResult
from features.web_gui.services.render_service import RenderReport


def _events(raw: str) -> list[tuple[str, dict]]:
    out = []
    pending = None
    for line in raw.splitlines():
        if line.startswith("event: "):
            pending = line[len("event: "):]
        elif line.startswith("data: ") and pending:
            out.append((pending, json.loads(line[len("data: "):])))
            pending = None
    return out


@pytest.mark.asyncio
async def test_orchestrator_emits_full_phase_sequence(monkeypatch):
    # Stub each phase
    fake_plan = StudioPlan(
        category="meta-ads", template_id="01-portfolio-grid",
        methodology="pas",
        brief=Brief(product="p", audience="a", pain="x", ctas=["go"]),
        n_variants=2, reasoning="ok",
    )

    monkeypatch.setattr(orchestrator, "plan", lambda req: fake_plan)

    fake_variant = CopyVariant(
        id="V1", headline="H1", primary_text="P1", description="D1",
        ctas=["go"], confidence="high", confidence_score=0.9,
        axes=VariantAxes(0.9, 0.8, 0.85), reasoning="r",
    )
    fake_agent_result = AgentResult(
        run_id="run-test", variants=[fake_variant], trace="t", trace_structured=[],
        methodology="pas", model="dry-run", pipeline_version="v0",
        seed=None, created_at="2026-04-30T00:00:00Z",
    )
    monkeypatch.setattr(orchestrator, "agent_generate", lambda *a, **k: fake_agent_result)

    async def _fake_render_one(category, template_id, n_variants):
        item_url = "/renders/01-portfolio-grid.png"
        # yield a single progress event then return a report-like dict
        yield ("progress", {"file": "01-portfolio-grid.png", "status": "rendering"})
        yield ("progress", {"file": "01-portfolio-grid.png", "status": "ok", "url": item_url})
        yield ("done", RenderReport(
            category="meta-ads", started_at="s", finished_at="f", duration_ms=10,
            results=[],
        ))

    monkeypatch.setattr(orchestrator, "render_one", _fake_render_one)

    raw = ""
    async for chunk in orchestrator.stream(StudioRequest(prompt="ad request")):
        raw += chunk

    events = _events(raw)
    names = [n for n, _ in events]

    # Phase markers in order
    assert names[0] == "run_start"
    assert names[-1] == "done"
    assert "plan_decided" in names
    # Three node_start nodes: planning, copy, render
    starts = [d["node_id"] for n, d in events if n == "node_start"]
    assert starts == ["planning", "copy", "render"]
    # Each ends
    dones = [d["node_id"] for n, d in events if n == "node_done"]
    assert dones == ["planning", "copy", "render"]
    # render_progress emitted twice
    progress = [d for n, d in events if n == "render_progress"]
    assert len(progress) == 2
    assert progress[0]["status"] == "rendering"
    assert progress[1]["status"] == "ok"
    assert progress[1]["url"] == "/renders/01-portfolio-grid.png"


@pytest.mark.asyncio
async def test_orchestrator_emits_error_on_planner_failure(monkeypatch):
    def _boom(req):
        raise RuntimeError("planner exploded")

    monkeypatch.setattr(orchestrator, "plan", _boom)

    raw = ""
    async for chunk in orchestrator.stream(StudioRequest(prompt="x")):
        raw += chunk
    events = _events(raw)
    names = [n for n, _ in events]
    assert "error" in names
    err = next(d for n, d in events if n == "error")
    assert err["code"] == "PLANNER_FAILED"
    assert "planner exploded" in err["error"]
```

- [ ] **Step 2: Run — FAIL**.

- [ ] **Step 3: GREEN — implement**

```python
# features/studio_agent/orchestrator.py
"""Orchestrator: StudioRequest -> SSE event stream.

Phases (node_id values, in order): planning -> copy -> render.
Emits the existing SSE vocab from copy_generation.streaming plus two
additions: plan_decided (between planning done and copy start) and
render_progress (during the render phase).

The token event for the copy phase carries node_id="copy"; the existing
FlowView Generate.tsx uses node_id="agent" — both coexist in the front-end
because the routing is by node_id, not by event name.
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


# ---- render_one: small adapter so tests can stub a single async generator
# ------------------------------------------------------------------------

_CATEGORY_TO_URL_PREFIX = {
    "brand-pack": "/brand/",
    "meta-ads":   "/renders/",
    "instagram":  "/instagram/",
}


async def render_one(category: str, template_id: str, n_variants: int):
    """Run the matching render_service function and yield ('progress', ...)
    or ('done', RenderReport).

    For meta-ads we filter by template_id's leading id. For instagram we
    filter by stem. brand-pack ignores template_id (renders the whole pack).
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


# ---- main streamer
# ------------------------------------------------------------------------

async def stream(req: StudioRequest, model: str = "claude-sonnet-4-6") -> AsyncIterator[str]:
    run_start = time.monotonic()
    run_id = f"studio-{int(time.time() * 1000)}"

    yield _sse("run_start", {
        "run_id": run_id,
        "pipeline_version": "studio_agent@v1",
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })

    # Phase 1 — planning
    yield _sse("node_start", {"node_id": "planning", "label": "Entendendo seu pedido", "start_ms": 0})
    try:
        # plan() is sync; run it in a thread so the loop doesn't block on the CLI shell
        sp = await asyncio.to_thread(plan, req)
    except Exception as e:
        yield _sse("error", {
            "code": "PLANNER_FAILED",
            "error": f"planner failed: {e}",
        })
        return

    yield _sse("node_done", {
        "node_id": "planning", "end_ms": _now_ms(run_start),
        "tokens": 0, "confidence": None,
        "output_preview": sp.reasoning[:80],
    })
    yield _sse("plan_decided", {"plan": _serialize_plan(sp)})

    # Phase 2 — copy
    yield _sse("node_start", {"node_id": "copy", "label": "Gerando copy", "start_ms": _now_ms(run_start)})
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
            **asdict(v), "axes": asdict(v.axes), "confidence_symbol": v.confidence_symbol,
        })
    yield _sse("node_done", {
        "node_id": "copy", "end_ms": _now_ms(run_start),
        "tokens": 0, "confidence": result.variants[0].confidence_score if result.variants else None,
        "output_preview": (result.variants[0].headline[:80] if result.variants else ""),
    })

    # Phase 3 — render
    yield _sse("node_start", {"node_id": "render", "label": "Renderizando", "start_ms": _now_ms(run_start)})
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
        "node_id": "render", "end_ms": _now_ms(run_start),
        "tokens": 0, "confidence": None,
        "output_preview": f"{ok}/{total} renderizados",
    })

    # done envelope
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
```

- [ ] **Step 4: Run — PASS** (`pytest features/studio_agent/test_orchestrator.py -v`).

- [ ] **Step 5: Commit**

```bash
git add features/studio_agent/orchestrator.py features/studio_agent/test_orchestrator.py
git commit -m "feat(studio_agent): orchestrator emits SSE for planning -> copy -> render"
```

---

## Task 4: feature CLAUDE.md + API route

**Files:**
- Create: `features/studio_agent/CLAUDE.md`
- Create: `features/web_gui/api/studio.py`
- Create: `features/web_gui/api/test_studio.py`
- Modify: `features/web_gui/server.py`

- [ ] **Step 1: Write CLAUDE.md** (no test step — pure docs):

```markdown
# features/studio_agent — agent context

Inherits from the root `CLAUDE.md` and `features/copy_generation/CLAUDE.md`.

## What this does

Conversational layer: a free-form prompt → `StudioPlan` (category +
template_id + methodology + brief + n_variants) → orchestrated execution
via `copy_generation.agent.generate` + `render_service.render_*`.

## Entry-points

- `planner.plan(request)` — sync; dry-run keyword routing or real CLI shell
- `orchestrator.stream(request)` — async; yields SSE frames for the full
  planning → copy → render pipeline

## Non-obvious constraints

- **Dry-run plan is deterministic by keyword.** This keeps tests stable without
  CLI access. Real-mode is the *only* path that does semantic intent matching.
- **Plan is one-shot per request in v1.** No back-and-forth; if the prompt is
  ambiguous, plan() defaults to `meta-ads/01-portfolio-grid/pas` rather than
  asking. The user can refine and resend.
- **`plan()` is sync; orchestrator wraps it in `asyncio.to_thread`.** The CLI
  is a blocking subprocess; running it in the loop would freeze every other
  client.
- **`render_progress` events carry `url` only when status="ok".** UIs should
  treat missing url as "still rendering" (the file isn't on disk yet).
- **`token` events for copy phase carry `node_id="copy"`.** The existing
  copy_generation streamer uses `"agent"` — both coexist; UIs route by
  node_id, not by event name.
```

- [ ] **Step 2: RED — failing route tests**

```python
# features/web_gui/api/test_studio.py
import json

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

    with client.stream("POST", "/api/v1/studio/request",
                       json={"prompt": "ad about new service"}) as r:
        assert r.status_code == 200
        assert "text/event-stream" in r.headers["content-type"]
        raw = r.read().decode()

    assert "event: run_start" in raw
    assert "event: done" in raw


def test_post_studio_request_400_on_empty_prompt(client):
    r = client.post("/api/v1/studio/request", json={"prompt": "  "})
    assert r.status_code == 400
    assert r.json()["code"] == "INVALID_REQUEST"


def test_post_studio_request_400_on_invalid_n_variants(client):
    r = client.post("/api/v1/studio/request",
                    json={"prompt": "x", "n_variants": 0})
    assert r.status_code == 400
    assert r.json()["code"] == "INVALID_REQUEST"
```

- [ ] **Step 3: Run — FAIL** (404 — route not registered).

- [ ] **Step 4: GREEN — implement route**

```python
# features/web_gui/api/studio.py
"""Studio routes — conversational entry-point.

POST /api/v1/studio/request   -- SSE stream of orchestrator events
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from features.studio_agent import orchestrator
from features.studio_agent.schema import StudioRequest

router = APIRouter(prefix="/studio", tags=["studio"])


class _StudioBody(BaseModel):
    prompt: str = Field(..., min_length=1)
    n_variants: int = Field(default=3, ge=1, le=8)


@router.post("/request")
def post_request(body: _StudioBody):
    try:
        req = StudioRequest(prompt=body.prompt, n_variants=body.n_variants)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": str(e), "code": "INVALID_REQUEST"},
        ) from e

    async def _gen():
        async for chunk in orchestrator.stream(req):
            yield chunk

    return StreamingResponse(_gen(), media_type="text/event-stream")
```

Modify `features/web_gui/server.py` — add `studio` to imports + `include_router`:

```python
# (server.py imports row, append)
from features.web_gui.api import (
    assets, brand_files, briefs, creatives, generate,
    projects, render, studio, traces, variants,
)

# inside create_app, after the render include:
app.include_router(studio.router, prefix="/api/v1")
```

- [ ] **Step 5: Run — PASS**.

- [ ] **Step 6: Commit**

```bash
git add features/studio_agent/CLAUDE.md features/web_gui/api/studio.py features/web_gui/api/test_studio.py features/web_gui/server.py
git commit -m "feat(web_gui): /api/v1/studio/request SSE route + CLAUDE.md"
```

---

## Task 5: api.ts client + types

**Files:**
- Modify: `features/web_gui/ui/src/types.ts`
- Modify: `features/web_gui/ui/src/api.ts`
- Modify: `features/web_gui/ui/src/api.test.ts`

- [ ] **Step 1: RED — failing test for streamStudioRequest**

Append to `api.test.ts`:

```ts
describe('streamStudioRequest', () => {
  beforeEach(() => {});
  afterEach(() => vi.restoreAllMocks());

  it('calls /api/v1/studio/request with the prompt', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      new Response('event: done\ndata: {}\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
    );
    vi.spyOn(global, 'fetch').mockImplementation(fakeFetch);

    const events: any[] = [];
    await new Promise<void>(resolve => {
      streamStudioRequest(
        { prompt: 'ad about service', n_variants: 3 },
        (e) => events.push(e),
        () => resolve(),
      );
    });

    expect(fakeFetch).toHaveBeenCalledWith(
      '/api/v1/studio/request',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ prompt: 'ad about service', n_variants: 3 }),
      }),
    );
    expect(events.find(e => e.type === 'done')).toBeDefined();
  });

  it('parses plan_decided + render_progress events', async () => {
    const body =
      'event: plan_decided\ndata: {"plan":{"category":"meta-ads"}}\n\n' +
      'event: render_progress\ndata: {"file":"x.png","status":"ok"}\n\n' +
      'event: done\ndata: {}\n\n';
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(body, {
        status: 200, headers: { 'content-type': 'text/event-stream' },
      }),
    );

    const events: any[] = [];
    await new Promise<void>(resolve => {
      streamStudioRequest(
        { prompt: 'x' },
        (e) => events.push(e),
        () => resolve(),
      );
    });

    expect(events.map(e => e.type)).toEqual(['plan_decided', 'render_progress', 'done']);
    expect(events[0].payload.plan.category).toBe('meta-ads');
    expect(events[1].payload.file).toBe('x.png');
  });
});
```

Also add the import: `import { streamStudioRequest } from './api';` at the top.

- [ ] **Step 2: Run — FAIL**.

- [ ] **Step 3: GREEN — implement client**

In `types.ts` append:

```ts
export interface StudioPlanPayload {
  category: 'brand-pack' | 'meta-ads' | 'instagram';
  template_id: string;
  methodology: string;
  n_variants: number;
  reasoning: string;
  brief: {
    product: string;
    audience: string;
    pain: string;
    ctas: string[];
    social_proof: string | null;
  };
}

export interface RenderProgressPayload {
  file: string;
  status: 'rendering' | 'ok' | 'failed' | 'missing' | 'error';
  url: string | null;
}

export interface StudioRequest {
  prompt: string;
  n_variants?: number;
}

export type StudioStreamEvent =
  | { type: 'run_start';      payload: { run_id: string; pipeline_version: string; started_at: string } }
  | { type: 'node_start';     payload: { node_id: string; label: string; start_ms: number } }
  | { type: 'node_done';      payload: { node_id: string; end_ms: number; tokens: number; confidence: number | null; output_preview: string } }
  | { type: 'token';          payload: { node_id: string; variant_id: string | null; text: string } }
  | { type: 'plan_decided';   payload: { plan: StudioPlanPayload } }
  | { type: 'variant_done';   payload: CopyVariant }
  | { type: 'render_progress'; payload: RenderProgressPayload }
  | { type: 'done';           payload: { run_id: string; plan: StudioPlanPayload; variants: CopyVariant[]; render: { category: string; ok_count: number; total: number; duration_ms: number } } }
  | { type: 'error';          payload: { error: string; code: string; raw?: string } };
```

In `api.ts` add the streamer (mirrors `streamGenerate`):

```ts
export function streamStudioRequest(
  payload: StudioRequest,
  onEvent: (e: StudioStreamEvent) => void,
  onComplete?: () => void,
  fetchImpl: typeof fetch = fetch,
): () => void {
  const controller = new AbortController();
  (async () => {
    const r = await fetchImpl(`${BASE}/studio/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!r.body) {
      onEvent({ type: 'error', payload: { error: 'SSE response has no body', code: 'NO_BODY' } });
      onComplete?.();
      return;
    }
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const lines = block.split('\n');
        let eventName = '';
        let dataStr = '';
        for (const line of lines) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
        }
        if (eventName && dataStr) {
          try {
            onEvent({ type: eventName as StudioStreamEvent['type'], payload: JSON.parse(dataStr) });
          } catch (err) {
            onEvent({ type: 'error', payload: { error: `malformed SSE frame: ${(err as Error).message}`, code: 'SSE_PARSE_ERROR', raw: dataStr.slice(0, 200) } });
          }
        }
      }
    }
    onComplete?.();
  })();
  return () => controller.abort();
}
```

Also import the StudioRequest/StudioStreamEvent types in api.ts.

- [ ] **Step 4: Run — PASS** (`cd features/web_gui/ui && npx vitest run src/api.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add features/web_gui/ui/src/types.ts features/web_gui/ui/src/api.ts features/web_gui/ui/src/api.test.ts
git commit -m "feat(ui/api): streamStudioRequest + plan/render-progress event types"
```

---

## Task 6: Conversational input + live stream + per-asset progress in Studio

**Files:**
- Create: `features/web_gui/ui/src/components/ConversationalPrompt.tsx`
- Create: `features/web_gui/ui/src/components/ConversationalPrompt.test.tsx`
- Create: `features/web_gui/ui/src/components/StudioStream.tsx`
- Create: `features/web_gui/ui/src/components/StudioStream.test.tsx`
- Modify: `features/web_gui/ui/src/components/Studio.tsx`
- Modify: `features/web_gui/ui/src/components/Studio.test.tsx`

This task delivers the look-and-feel the user explicitly asked for:
"input grande, eu peço X, vejo acontecer em tempo real."

**ConversationalPrompt.tsx** — a textarea + Send button at the top of the
Studio. Submits a `StudioRequest`, calls `streamStudioRequest`, propagates
events upward via callbacks. Auto-grows on input. Disabled while a stream
is in flight. Shows the prompt as a sent-message bubble once submitted.

**StudioStream.tsx** — the live-progress panel. Mirrors the visual language
of `Generate.tsx` (token feed in dark monospace + node graph), but adapted
for the 3 phases (planning / copy / render). Shows:
- A node graph (3 dots: planning → copy → render), each lit when its
  node_start fires and dimmed when node_done fires.
- A token panel that shows the most recent ~40 chars of streaming text
  for the active node.
- A render-progress strip listing each `render_progress` event with its
  file name + status pill.

**Studio.tsx** modifications: above the existing 3 sections, render
`<ConversationalPrompt onSubmit={…} disabled={busy}/>` and, while a stream
is active, `<StudioStream events={events}/>`. When the stream's `done` fires,
re-fetch the manifest so the asset card flips from pendente to thumbnail
(this just slots into the existing `reloadKey` mechanism).

- [ ] **Step 1: RED — write the ConversationalPrompt test**

```tsx
// ConversationalPrompt.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConversationalPrompt } from './ConversationalPrompt';

describe('ConversationalPrompt', () => {
  it('renders an empty textarea + Send button', () => {
    render(<ConversationalPrompt onSubmit={() => {}} busy={false}/>);
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument();
  });

  it('Send is disabled when prompt is empty', () => {
    render(<ConversationalPrompt onSubmit={() => {}} busy={false}/>);
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('Send is disabled when busy', () => {
    render(<ConversationalPrompt onSubmit={() => {}} busy={true}/>);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x' } });
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('clicking Send calls onSubmit with the trimmed prompt', () => {
    const onSubmit = vi.fn();
    render(<ConversationalPrompt onSubmit={onSubmit} busy={false}/>);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '  preciso de um post sobre lançamento  ' }
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    expect(onSubmit).toHaveBeenCalledWith('preciso de um post sobre lançamento');
  });

  it('Cmd+Enter / Ctrl+Enter submits', () => {
    const onSubmit = vi.fn();
    render(<ConversationalPrompt onSubmit={onSubmit} busy={false}/>);
    const ta = screen.getByRole('textbox');
    fireEvent.change(ta, { target: { value: 'hello' } });
    fireEvent.keyDown(ta, { key: 'Enter', metaKey: true });
    expect(onSubmit).toHaveBeenCalledWith('hello');
  });
});
```

- [ ] **Step 2: Run — FAIL**.

- [ ] **Step 3: GREEN — ConversationalPrompt.tsx**

```tsx
// Conversational input — single textarea + Send. Submits a free-form
// prompt that the studio_agent translates into a StudioPlan.
//
// Auto-grows up to 6 lines. Cmd+Enter / Ctrl+Enter submits. Disabled
// while a stream is running so we don't spawn parallel runs.
import { useRef, useState } from 'react';

interface ConversationalPromptProps {
  onSubmit: (prompt: string) => void;
  busy: boolean;
}

export function ConversationalPrompt({ onSubmit, busy }: ConversationalPromptProps) {
  const [value, setValue] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  function trySubmit() {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
  }

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e7e5e4',
      borderRadius: 12,
      padding: 14,
      display: 'flex',
      gap: 10,
      alignItems: 'flex-end',
      boxShadow: '0 1px 2px rgba(28,25,23,0.03)',
    }}>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          // Auto-grow up to 6 lines
          const ta = taRef.current;
          if (ta) {
            ta.style.height = 'auto';
            ta.style.height = `${Math.min(ta.scrollHeight, 144)}px`;
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            trySubmit();
          }
        }}
        placeholder="Pedir pra Claude — descreva em linguagem natural o que você precisa…"
        rows={1}
        disabled={busy}
        style={{
          flex: 1, resize: 'none',
          fontFamily: 'inherit', fontSize: 14, color: '#1c1917',
          border: 'none', outline: 'none',
          background: 'transparent',
          minHeight: 22, maxHeight: 144,
          lineHeight: 1.5,
          padding: '4px 0',
        }}
      />
      <button
        type="button"
        onClick={trySubmit}
        disabled={busy || !value.trim()}
        aria-label="Enviar"
        style={{
          padding: '7px 14px', borderRadius: 8,
          background: busy || !value.trim() ? '#e7e5e4' : '#1c1917',
          color: busy || !value.trim() ? '#78716c' : '#fafaf9',
          border: 'none',
          cursor: busy || !value.trim() ? 'default' : 'pointer',
          fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
          flexShrink: 0,
        }}
      >
        {busy ? 'Trabalhando…' : 'Enviar'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run — PASS**.

- [ ] **Step 5: RED — write StudioStream test**

```tsx
// StudioStream.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StudioStream } from './StudioStream';
import type { StudioStreamEvent } from '../types';

const _events = (xs: Array<[string, any]>): StudioStreamEvent[] =>
  xs.map(([type, payload]) => ({ type, payload }) as StudioStreamEvent);

describe('StudioStream', () => {
  it('renders three node dots labelled planning / copy / render', () => {
    render(<StudioStream events={[]}/>);
    expect(screen.getByText(/Entendendo/i)).toBeInTheDocument();
    expect(screen.getByText(/Gerando copy/i)).toBeInTheDocument();
    expect(screen.getByText(/Renderizando/i)).toBeInTheDocument();
  });

  it('lights up planning node when its node_start fires', () => {
    const ev = _events([
      ['run_start', { run_id: 'r1', pipeline_version: 'v', started_at: 's' }],
      ['node_start', { node_id: 'planning', label: 'Entendendo seu pedido', start_ms: 0 }],
    ]);
    render(<StudioStream events={ev}/>);
    expect(screen.getByTestId('node-planning')).toHaveAttribute('data-state', 'active');
  });

  it('shows plan summary after plan_decided', () => {
    const ev = _events([
      ['plan_decided', { plan: { category: 'meta-ads', template_id: '01-portfolio-grid', methodology: 'pas', n_variants: 3, reasoning: 'because', brief: { product: 'p', audience: 'a', pain: 'x', ctas: ['go'], social_proof: null } } }],
    ]);
    render(<StudioStream events={ev}/>);
    expect(screen.getByText(/01-portfolio-grid/)).toBeInTheDocument();
    expect(screen.getByText(/pas/i)).toBeInTheDocument();
  });

  it('lists render_progress events with status pill', () => {
    const ev = _events([
      ['render_progress', { file: 'a.png', status: 'rendering', url: null }],
      ['render_progress', { file: 'a.png', status: 'ok', url: '/r/a.png' }],
    ]);
    render(<StudioStream events={ev}/>);
    expect(screen.getByText('a.png')).toBeInTheDocument();
    expect(screen.getByText(/ok/i)).toBeInTheDocument();
  });

  it('renders an alert when error event is received', () => {
    const ev = _events([
      ['error', { code: 'PLANNER_FAILED', error: 'boom' }],
    ]);
    render(<StudioStream events={ev}/>);
    expect(screen.getByRole('alert')).toHaveTextContent(/boom/);
  });
});
```

- [ ] **Step 6: Run — FAIL**.

- [ ] **Step 7: GREEN — StudioStream.tsx**

```tsx
// Live progress panel for a studio run.
// Three nodes (planning / copy / render) shown as a horizontal pipeline.
// Each node lights up when its node_start fires and dims when node_done.
// Below the pipeline: plan summary card (after plan_decided),
// streaming token preview, and a list of render_progress entries.
import { useMemo } from 'react';
import type { StudioStreamEvent, StudioPlanPayload, RenderProgressPayload } from '../types';

interface StudioStreamProps {
  events: StudioStreamEvent[];
}

const NODES = [
  { id: 'planning', label: 'Entendendo seu pedido' },
  { id: 'copy',     label: 'Gerando copy' },
  { id: 'render',   label: 'Renderizando' },
] as const;

interface NodeStateMap {
  [nodeId: string]: 'idle' | 'active' | 'done';
}

export function StudioStream({ events }: StudioStreamProps) {
  const { nodeStates, plan, renderProgress, errorMsg, lastTokens } = useMemo(() => {
    const states: NodeStateMap = { planning: 'idle', copy: 'idle', render: 'idle' };
    let plan: StudioPlanPayload | null = null;
    const progress: RenderProgressPayload[] = [];
    let errorMsg: string | null = null;
    const tokensByNode: Record<string, string> = {};
    for (const e of events) {
      if (e.type === 'node_start') states[e.payload.node_id] = 'active';
      else if (e.type === 'node_done') states[e.payload.node_id] = 'done';
      else if (e.type === 'plan_decided') plan = e.payload.plan;
      else if (e.type === 'render_progress') {
        // Replace existing entry for the same file (rendering -> ok)
        const idx = progress.findIndex(p => p.file === e.payload.file);
        if (idx >= 0) progress[idx] = e.payload;
        else progress.push(e.payload);
      } else if (e.type === 'token') {
        tokensByNode[e.payload.node_id] = (tokensByNode[e.payload.node_id] ?? '') + e.payload.text;
      } else if (e.type === 'error') {
        errorMsg = e.payload.error;
      }
    }
    return { nodeStates: states, plan, renderProgress: progress, errorMsg, lastTokens: tokensByNode };
  }, [events]);

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e7e5e4',
      borderRadius: 12,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      {/* Pipeline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {NODES.map((n, i) => (
          <Pipeline key={n.id} node={n} state={nodeStates[n.id]} isLast={i === NODES.length - 1} />
        ))}
      </div>

      {errorMsg && (
        <div role="alert" style={{
          padding: '8px 12px', fontSize: 12, color: '#dc2626',
          background: 'rgba(220,38,38,0.10)',
          border: '1px solid rgba(220,38,38,0.2)',
          borderRadius: 6, fontFamily: '"Geist Mono", monospace',
        }}>erro: {errorMsg}</div>
      )}

      {plan && <PlanCard plan={plan}/>}
      {lastTokens.copy && (
        <div style={{
          background: '#0a0a0a', color: '#a3e635',
          fontFamily: '"Geist Mono", monospace', fontSize: 11,
          padding: 10, borderRadius: 6, lineHeight: 1.5,
          maxHeight: 96, overflow: 'hidden',
        }}>
          {lastTokens.copy.slice(-360)}
        </div>
      )}
      {renderProgress.length > 0 && <RenderProgressList items={renderProgress}/>}
    </div>
  );
}

function Pipeline({ node, state, isLast }: {
  node: { id: string; label: string };
  state: 'idle' | 'active' | 'done';
  isLast: boolean;
}) {
  const dot = state === 'active' ? '#1c1917' : state === 'done' ? 'var(--accent, #04d361)' : '#d6d3d1';
  return (
    <>
      <div data-testid={`node-${node.id}`} data-state={state} style={{
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: dot,
          transition: 'background 200ms',
          ...(state === 'active' ? { animation: 'pulse 1.2s ease-in-out infinite' } : {}),
        }}/>
        <span style={{
          fontSize: 12, color: state === 'idle' ? '#a8a29e' : '#1c1917',
          fontWeight: state === 'active' ? 500 : 400,
        }}>{node.label}</span>
      </div>
      {!isLast && <div style={{ flex: 1, height: 1, background: '#e7e5e4' }}/>}
    </>
  );
}

function PlanCard({ plan }: { plan: StudioPlanPayload }) {
  return (
    <div style={{
      background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: 8,
      padding: '10px 12px', fontSize: 12, color: '#44403c',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{
          fontFamily: '"Geist Mono", monospace', fontSize: 10,
          background: '#1c1917', color: '#fafaf9',
          padding: '2px 6px', borderRadius: 4,
        }}>{plan.category}</span>
        <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 11 }}>
          {plan.template_id}
        </span>
        <span style={{ fontSize: 11, color: '#78716c' }}>·</span>
        <span style={{
          fontFamily: '"Geist Mono", monospace', fontSize: 11, textTransform: 'uppercase',
        }}>{plan.methodology}</span>
        <span style={{ fontSize: 11, color: '#78716c' }}>·</span>
        <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 11 }}>
          n={plan.n_variants}
        </span>
      </div>
      {plan.reasoning && (
        <div style={{ fontSize: 11, color: '#6f6a64', fontStyle: 'italic' }}>
          {plan.reasoning}
        </div>
      )}
    </div>
  );
}

function RenderProgressList({ items }: { items: RenderProgressPayload[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map(it => (
        <div key={it.file} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: '"Geist Mono", monospace', fontSize: 11,
          padding: '4px 8px', borderRadius: 4,
          background: it.status === 'ok' ? 'rgba(4, 211, 97, 0.08)' : '#fafaf9',
          color: it.status === 'failed' ? '#dc2626' : '#1c1917',
        }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: it.status === 'ok' ? 'var(--accent, #04d361)' :
                        it.status === 'failed' || it.status === 'error' ? '#dc2626' :
                        '#a8a29e',
            ...(it.status === 'rendering' ? { animation: 'pulse 1.2s ease-in-out infinite' } : {}),
          }}/>
          <span style={{ flex: 1 }}>{it.file}</span>
          <span style={{ fontSize: 10, color: '#6f6a64', textTransform: 'uppercase' }}>{it.status}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Run — PASS**.

- [ ] **Step 9: Wire into Studio.tsx**

Modify `Studio.tsx` to add prompt + stream above the existing 3 sections:

```tsx
// At top of Studio, near other imports:
import { ConversationalPrompt } from './ConversationalPrompt';
import { StudioStream } from './StudioStream';
import { streamStudioRequest } from '../api';
import type { StudioStreamEvent } from '../types';

// Add to Studio() body:
const [busy, setBusy] = useState(false);
const [streamEvents, setStreamEvents] = useState<StudioStreamEvent[]>([]);

const onPrompt = (prompt: string) => {
  setStreamEvents([]);
  setBusy(true);
  streamStudioRequest(
    { prompt, n_variants: 3 },
    (e) => setStreamEvents(prev => [...prev, e]),
    () => {
      setBusy(false);
      setReloadKey(k => k + 1);  // refresh manifest so new asset appears
    },
  );
};

// In the JSX, above the 3 SECTIONS map:
<div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
  <ConversationalPrompt onSubmit={onPrompt} busy={busy}/>
  {(busy || streamEvents.length > 0) && <StudioStream events={streamEvents}/>}
</div>
```

Move the existing 3-sections grid below this header into the same outer
container (or adjust padding to match).

- [ ] **Step 10: Run all UI tests — verify no regressions**

```bash
cd features/web_gui/ui && npx vitest run
```

- [ ] **Step 11: Commit**

```bash
git add features/web_gui/ui/src/components/ConversationalPrompt.tsx features/web_gui/ui/src/components/ConversationalPrompt.test.tsx features/web_gui/ui/src/components/StudioStream.tsx features/web_gui/ui/src/components/StudioStream.test.tsx features/web_gui/ui/src/components/Studio.tsx
git commit -m "feat(ui/Studio): conversational prompt + live SSE stream panel"
```

---

## Task 7: Asset card polish — hover state + tooltip + smooth transitions

**Files:**
- Modify: `features/web_gui/ui/src/components/Studio.tsx` (replace inline `AssetCard` with `AssetCardRich`)
- Create: `features/web_gui/ui/src/components/AssetCardRich.tsx`
- Create: `features/web_gui/ui/src/components/AssetCardRich.test.tsx`

The user said "tudo bonitinho as imagens, descricao quando hover etc". This
task delivers exactly that on the existing grid: hover lifts the card,
shows shadow, and reveals a tooltip with a contextual human-readable
description (derived from category + dimensions + relative_path).

- [ ] **Step 1: RED — write hover + description tests**

```tsx
// AssetCardRich.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AssetCardRich, describeAsset } from './AssetCardRich';

const item = (overrides: any = {}) => ({
  category: 'meta-ads',
  relative_path: '01-portfolio-grid.png',
  url: '/renders/01-portfolio-grid.png',
  width: 1080, height: 1080,
  exists: true,
  ...overrides,
});

describe('describeAsset', () => {
  it('describes a Meta Ad with size + ratio', () => {
    expect(describeAsset(item())).toMatch(/Meta Ad/i);
    expect(describeAsset(item())).toMatch(/1080×1080/);
    expect(describeAsset(item())).toMatch(/quadrado/i);
  });

  it('uses landscape descriptor for wide assets', () => {
    expect(describeAsset(item({ width: 1584, height: 396 }))).toMatch(/horizontal|paisag/i);
  });

  it('uses portrait descriptor for tall assets', () => {
    expect(describeAsset(item({ width: 1080, height: 1920 }))).toMatch(/vertical|retrato/i);
  });

  it('describes brand-favicons with the favicon role', () => {
    expect(describeAsset(item({
      category: 'brand-favicons', relative_path: 'favicons/icon-512.png',
      width: 512, height: 512,
    }))).toMatch(/favicon/i);
  });

  it('describes instagram singles', () => {
    expect(describeAsset(item({
      category: 'instagram', relative_path: 'single-manifesto.png',
      width: 1080, height: 1350,
    }))).toMatch(/Instagram/i);
  });
});

describe('AssetCardRich hover', () => {
  it('renders the tooltip text after mouseenter', () => {
    render(<AssetCardRich item={item()} reloadKey={0}/>);
    const card = screen.getByTestId('asset-card');
    fireEvent.mouseEnter(card);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Meta Ad/i);
  });

  it('hides the tooltip after mouseleave', () => {
    render(<AssetCardRich item={item()} reloadKey={0}/>);
    const card = screen.getByTestId('asset-card');
    fireEvent.mouseEnter(card);
    fireEvent.mouseLeave(card);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('does not crash on pendente (exists=false) cards', () => {
    render(<AssetCardRich item={item({ exists: false })} reloadKey={0}/>);
    expect(screen.getByText(/pendente/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — FAIL**.

- [ ] **Step 3: GREEN — AssetCardRich.tsx**

```tsx
// Polished asset card — hover lift, shadow, tooltip with rich description.
// Replaces the inline AssetCard previously inside Studio.tsx.
import { useState } from 'react';
import type { RenderManifestItem } from '../types';

interface AssetCardRichProps {
  item: RenderManifestItem;
  reloadKey: number;
}

const _CATEGORY_LABEL: Record<string, string> = {
  'brand-logos': 'Logo',
  'brand-social': 'Imagem social',
  'brand-favicons': 'Favicon',
  'meta-ads': 'Meta Ad',
  'instagram': 'Instagram',
};

function _ratioLabel(w: number, h: number): string {
  const r = w / h;
  if (Math.abs(r - 1) < 0.05) return 'quadrado (1:1)';
  if (r > 1.5) return 'horizontal';
  if (r < 0.7) return 'vertical';
  return r > 1 ? 'paisagem' : 'retrato';
}

function _instagramSubcategory(rel: string): string {
  if (rel.startsWith('single-')) return 'Post (feed)';
  if (rel.startsWith('carousel-')) return 'Carrossel';
  if (rel.startsWith('highlight-cover-')) return 'Capa de destaque';
  if (rel.startsWith('story-starter-')) return 'Story';
  if (rel.startsWith('account-avatar')) return 'Avatar';
  return '';
}

export function describeAsset(item: RenderManifestItem): string {
  const base = _CATEGORY_LABEL[item.category] ?? item.category;
  const dim = `${item.width}×${item.height}`;
  const ratio = _ratioLabel(item.width, item.height);
  if (item.category === 'instagram') {
    const sub = _instagramSubcategory(item.relative_path);
    return sub ? `${base} · ${sub} · ${dim} ${ratio}` : `${base} · ${dim} ${ratio}`;
  }
  return `${base} · ${dim} ${ratio}`;
}

export function AssetCardRich({ item, reloadKey }: AssetCardRichProps) {
  const [hover, setHover] = useState(false);
  const src = item.exists ? `${item.url}?v=${reloadKey}` : null;
  return (
    <div
      data-testid="asset-card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff',
        border: hover ? '1px solid #d6d3d1' : '1px solid #e7e5e4',
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 8px 24px rgba(28,25,23,0.10)' : '0 1px 2px rgba(28,25,23,0.02)',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
      }}
    >
      <div style={{
        aspectRatio: `${item.width} / ${item.height}`,
        background: item.exists
          ? '#0a0a0a'
          : 'repeating-linear-gradient(45deg, #fafaf9 0 8px, #f5f5f4 8px 16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {src ? (
          <img
            src={src}
            alt={item.relative_path}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <span style={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: 10, color: '#78716c',
            textTransform: 'uppercase', letterSpacing: 0.6,
          }}>pendente</span>
        )}
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{
          fontSize: 11, color: '#1c1917',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{item.relative_path}</div>
        <div style={{
          fontSize: 10, color: '#6f6a64',
          fontFamily: '"Geist Mono", monospace', marginTop: 1,
        }}>{item.width}×{item.height}</div>
      </div>
      {hover && (
        <div role="tooltip" style={{
          position: 'absolute',
          top: 8, left: 8, right: 8,
          background: 'rgba(28,25,23,0.92)',
          backdropFilter: 'blur(8px)',
          color: '#fafaf9',
          padding: '6px 10px',
          borderRadius: 6,
          fontSize: 11,
          fontFamily: '"Geist Mono", monospace',
          letterSpacing: 0.2,
          pointerEvents: 'none',
          animation: 'fadeIn 0.12s ease-out',
        }}>{describeAsset(item)}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Studio.tsx — replace inline AssetCard with AssetCardRich**

In `Studio.tsx`:
- Remove the inline `AssetCard` function definition (lines ~157-208 of current).
- Replace the `<AssetCard …/>` usage in the SECTIONS map with `<AssetCardRich …/>`.
- Add `import { AssetCardRich } from './AssetCardRich';` to the imports.

- [ ] **Step 5: Run all UI tests — PASS**

```bash
cd features/web_gui/ui && npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add features/web_gui/ui/src/components/AssetCardRich.tsx features/web_gui/ui/src/components/AssetCardRich.test.tsx features/web_gui/ui/src/components/Studio.tsx
git commit -m "feat(ui/Studio): rich asset card — hover lift, tooltip with contextual description"
```

---

## Task 8: Sub-grouping inside the Marca section

**Files:**
- Modify: `features/web_gui/ui/src/components/Studio.tsx`
- Modify: `features/web_gui/ui/src/components/Studio.test.tsx`

In production the Marca section mixes logos / social / favicons in one
grid (15 cards, no visual cue separating them — see screenshot). This
task adds a sub-divider per category so the user sees the structure.

- [ ] **Step 1: RED — write subgroup test**

Append to `Studio.test.tsx`:

```tsx
it('renders sub-headings for logos / social / favicons inside Marca', async () => {
  vi.spyOn(api, 'getRenderManifest').mockResolvedValue({
    categories: {
      'brand-logos':    [{ category: 'brand-logos', relative_path: 'logos/x.png', url: '/brand/logos/x.png', width: 100, height: 100, exists: false }],
      'brand-social':   [{ category: 'brand-social', relative_path: 'social/renders/y.png', url: '/brand/social/renders/y.png', width: 100, height: 100, exists: false }],
      'brand-favicons': [{ category: 'brand-favicons', relative_path: 'favicons/z.png', url: '/brand/favicons/z.png', width: 32, height: 32, exists: false }],
      'meta-ads':       [],
      'instagram':      [],
    },
  });
  render(<Studio projectSlug="vibeweb"/>);
  await waitFor(() => {
    expect(screen.getByText(/^Logos/i)).toBeInTheDocument();
    expect(screen.getByText(/^Social/i)).toBeInTheDocument();
    expect(screen.getByText(/^Favicons/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — FAIL** (subgroups not yet implemented).

- [ ] **Step 3: GREEN — change the SECTIONS map for the Marca section**

In `Studio.tsx`, change how the Marca section renders. Instead of
`flatMap`-ing all three categories into one grid, render three sub-grids
each labelled. Concrete: replace the existing `items.map(...)` for the
Marca section with a sub-render that splits by category:

```tsx
// Inside the SECTIONS map, when sec.key === 'brand' render sub-categories:
{sec.key === 'brand' ? (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    {[
      { cat: 'brand-logos',    title: 'Logos' },
      { cat: 'brand-social',   title: 'Social' },
      { cat: 'brand-favicons', title: 'Favicons' },
    ].map(g => {
      const sub = manifest?.categories[g.cat] ?? [];
      if (sub.length === 0) return null;
      return (
        <div key={g.cat}>
          <div style={{
            fontSize: 11, textTransform: 'uppercase',
            letterSpacing: 0.6, color: '#78716c',
            marginBottom: 8, fontFamily: '"Geist Mono", monospace',
          }}>{g.title} <span style={{ color: '#a8a29e' }}>· {sub.length}</span></div>
          <div style={{
            display: 'grid', gap: 10,
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          }}>
            {sub.map(it => (
              <AssetCardRich key={it.relative_path} item={it} reloadKey={reloadKey}/>
            ))}
          </div>
        </div>
      );
    })}
  </div>
) : (
  <div style={{
    display: 'grid', gap: 10,
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  }}>
    {items.map(it => (
      <AssetCardRich key={`${it.category}/${it.relative_path}`} item={it} reloadKey={reloadKey}/>
    ))}
  </div>
)}
```

- [ ] **Step 4: Run — PASS**.

- [ ] **Step 5: Commit**

```bash
git add features/web_gui/ui/src/components/Studio.tsx features/web_gui/ui/src/components/Studio.test.tsx
git commit -m "feat(ui/Studio): sub-divisions Logos/Social/Favicons inside Marca"
```

---

## Task 9: Tech debt draft + final verification + deploy

- [ ] **Step 1: Tech debt draft (Linear MCP) — to user**

Spec produced this insight that should become a follow-up ticket:

> **Title:** Refactor 32 hardcoded copy templates so studio_agent can
> rewrite them
>
> **Description:** Today studio_agent decides a `template_id` and
> `Brief`, but only 26 of the 67 outputs accept the brief's copy without
> HTML edits (6 Meta Ads via `{{ copy.* }}`, 5 highlight types via
> `?type=`, 15 story slots via `?slot=`). The other 32 outputs (6 IG
> singles, 21 carousel slides across 3 carousels, 5 brand templates)
> have copy hardcoded inline. The agent currently re-renders these
> with their original baked-in copy — useful but not "new copy from
> prompt." This ticket: extract per-template copy into JSON/YAML
> sidecars (mirror the SLOTS pattern in story-starter.html) so a fresh
> `Brief` can drive every output.

The user reviews and creates the Linear ticket manually (per CLAUDE.md
"NEVER create issues automatically").

- [ ] **Step 2: Build the Vite bundle**

```bash
cd features/web_gui/ui && npm run build
```

- [ ] **Step 3: Run full pytest**

```bash
pytest -q
```

Expected: all green (existing 517 + new ~25 should be ~542 passing).

- [ ] **Step 4: Run vitest**

```bash
cd features/web_gui/ui && npx vitest run
```

Expected: existing 159 + new ~20 should be ~179 passing.

- [ ] **Step 5: Review Gate**

Dispatch `pr-review-toolkit:code-reviewer` on the diff since the start of
this branch. Address any BLOCKERS; ship NITS as separate commits.

- [ ] **Step 6: Push to origin/main**

```bash
git push origin main
```

- [ ] **Step 7: Deploy to VPS**

```bash
ssh -i ~/.ssh/ebl_vps -o IdentitiesOnly=yes vinicius@vinicius.xyz "cd ~/criativos && bash deploy/install.sh"
```

- [ ] **Step 8: Smoke test the conversational endpoint on the VPS**

```bash
ssh -i ~/.ssh/ebl_vps -o IdentitiesOnly=yes vinicius@vinicius.xyz \
  'curl -sN -X POST -H "content-type: application/json" -d "{\"prompt\":\"preciso de um post Instagram sobre lançamento de site\"}" http://127.0.0.1:8090/api/v1/studio/request | head -40'
```

Expected: stream of SSE events including `run_start`, `node_start(planning)`,
`node_done(planning)`, `plan_decided`, `node_start(copy)`, …, `done`.

- [ ] **Step 9: Visual smoke test via browser MCP**

Navigate to `https://criativos.vinicius.xyz/ui/`, ⌘4 to Studio, type
"preciso de um post Instagram sobre lançamento" in the prompt, click
Enviar. Confirm the live stream panel renders + the resulting asset
card flips from pendente to thumbnail.

---

## Summary of new file count

| Backend | Frontend |
|---|---|
| 5 src + 3 test = 8 files | 3 src + 3 test = 6 files |
| ~700 LoC + ~400 LoC tests | ~500 LoC + ~250 LoC tests |
