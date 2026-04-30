"""Planner: prompt -> StudioPlan.

Two modes:
  - **Dry-run** (default in tests / when no auth env is set): deterministic
    keyword routing. Cheap, predictable, no network — ideal for the dev loop.
  - **Real-mode**: shells out to `claude -p` with a strict system prompt that
    forces JSON output matching the StudioPlan schema. Mirrors the pattern in
    features/copy_generation/agent.py — second occurrence is OK per
    CLAUDE.md §2.3 (DAMP > DRY at two duplications); we'll extract the shared
    `_run_cli` helper on the third occurrence.
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
- instagram: single-manifesto | single-cost-of-inaction | single-niche-tag | single-proof-number | single-offer-mechanics | single-cta-pure | carousel-portfolio | carousel-services | carousel-process | highlight-cover-portfolio | highlight-cover-services | highlight-cover-about | highlight-cover-contact | highlight-cover-feed | story-starter-services-1 | story-starter-portfolio-1 | account-avatar
- brand-pack: brand   (the only template_id; renders the full pack)

Choose a methodology that matches the request's emotional arc:
- pas: Problem -> Agitate -> Solve (fear-based, for objections)
- aida: Attention -> Interest -> Desire -> Action (educational)
- bab: Before -> After -> Bridge (transformation stories)

When the user is vague, default to category=meta-ads, template_id=01-portfolio-grid,
methodology=pas. Never refuse — always emit a valid plan.
"""


def _is_dry_run() -> bool:
    if os.getenv("VIBEWEB_DRY_RUN") == "1":
        return True
    has_token = bool(
        os.getenv("CLAUDE_CODE_OAUTH_TOKEN") or os.getenv("ANTHROPIC_API_KEY")
    )
    return not has_token


def _build_cli_env() -> dict[str, str]:
    """Strip API-key env vars when an OAuth token is present.

    Mirrors features/copy_generation/agent.py — when a CLAUDE_CODE_OAUTH_TOKEN
    is set, a stale (non-empty but invalid) ANTHROPIC_API_KEY would beat the
    OAuth token in the Claude CLI's credential precedence and 401. Strip
    both ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN unconditionally in that
    case (this is the load-bearing branch for prod). Also strip empty
    strings — Claude CLI treats "" as a credential and fails instead of
    falling back.
    """
    env = os.environ.copy()
    oauth = env.get("CLAUDE_CODE_OAUTH_TOKEN", "")
    has_oauth = oauth.startswith("sk-ant-oat")
    for k in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"):
        if k not in env:
            continue
        if has_oauth or not env[k].strip():
            env.pop(k)
    return env


def _run_cli(prompt: str, system_prompt: str, model: str) -> Any:
    cli = shutil.which("claude")
    if not cli:
        raise RuntimeError(
            "claude CLI not on PATH; install via 'npm i -g @anthropic-ai/claude-code'"
        )
    proc = subprocess.run(
        [cli, "-p", prompt,
         "--append-system-prompt", system_prompt,
         "--output-format", "json",
         "--model", model],
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
    cleaned = _strip_markdown_fence(result_str)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"planner CLI returned non-JSON result body: {result_str[:500]!r}"
        ) from e


def _strip_markdown_fence(s: str) -> str:
    """Remove an optional ```json ... ``` (or ``` ... ```) wrapper.

    Claude often wraps JSON in fences even when the system prompt asks for
    raw output — the trained-in markdown habit is hard to suppress. We
    strip a leading ```<lang>\\n and a trailing ``` if both are present;
    everything else is returned unchanged.
    """
    stripped = s.strip()
    if not stripped.startswith("```"):
        return s
    # Drop the opening fence line (``` or ```json or ```JSON, etc.)
    nl = stripped.find("\n")
    if nl == -1:
        return s
    body = stripped[nl + 1:]
    if body.endswith("```"):
        body = body[:-3]
    return body.strip()


# Keyword -> category routing for dry-run deterministic synthesis.
# Ordering matters: the first match wins, so put the most specific buckets
# first (brand keywords are narrowest; instagram bucket would otherwise eat
# "highlight" and "story" which are also meta-ads concepts in some contexts).
_CATEGORY_KEYWORDS = [
    ("brand-pack", ("logo", "logotipo", "favicon", "marca", "logos", "wordmark")),
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
    category = "meta-ads"  # default for ambiguous prompts
    for cat, kws in _CATEGORY_KEYWORDS:
        if any(kw in p for kw in kws):
            category = cat
            break

    # StudioRequest.__post_init__ rejects empty/whitespace prompts, so
    # req.prompt[:80] is always non-empty here.
    return StudioPlan(
        category=category,
        template_id=_DEFAULT_TEMPLATES[category],
        methodology="pas",
        brief=Brief(
            product=req.prompt[:80],
            audience="audiência inferida",
            pain="dor inferida",
            ctas=["Saiba mais"],
            social_proof=None,
        ),
        n_variants=req.n_variants,
        reasoning=f"dry-run keyword route → {category}",
    )


def plan(req: StudioRequest, model: str = _DEFAULT_MODEL) -> StudioPlan:
    """Translate a free-form prompt into a StudioPlan.

    Sync because real-mode shells out to a blocking subprocess. Callers in
    async contexts should wrap with asyncio.to_thread.
    """
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
        raise RuntimeError(f"planner CLI returned malformed plan: {raw!r}") from e
