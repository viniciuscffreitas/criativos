"""Copy generation agent — Claude API wrapper with dry-run mode.

Modes (resolved by environment):
  - dry-run: VIBEWEB_DRY_RUN=1  OR  ANTHROPIC_API_KEY unset
  - real:    ANTHROPIC_API_KEY set AND VIBEWEB_DRY_RUN unset (or != 1)

Dry-run returns deterministic stub variants so tests and local dev cost zero
tokens. Real mode posts one messages.create() call; no streaming, no retry
loop — failures raise verbose to make their cause obvious.

Response format: text-block only. Extended thinking (thinking blocks) is not
supported — if enabled upstream, _call_claude raises RuntimeError rather than
silently picking a later block.
"""
from __future__ import annotations

import datetime
import json
import os
import uuid
from pathlib import Path

from features.copy_generation.methodologies import by_name
from features.copy_generation.schema import AgentResult, Brief, CopyVariant, VariantAxes

ROOT_DIR = Path(__file__).resolve().parents[2]

REQUIRED_VARIANT_FIELDS = {
    "headline", "primary_text", "description", "ctas",
    "confidence", "confidence_score", "axes", "reasoning",
}

DEFAULT_MODEL = "claude-sonnet-4-6"
DRY_RUN_MODEL_TAG = "dry-run"
VALID_CONFIDENCE = {"high", "medium", "low"}


def _is_dry_run() -> bool:
    if os.getenv("VIBEWEB_DRY_RUN") == "1":
        return True
    if not os.getenv("ANTHROPIC_API_KEY"):
        return True
    return False


def _dry_run_variants(brief: Brief, methodology_name: str, n: int) -> AgentResult:
    run_id = uuid.uuid4().hex[:8]
    variants = [
        CopyVariant(
            id=f"V{i+1}",
            headline=f"[{methodology_name.upper()} v{i+1}] {brief.pain[:30]}",
            primary_text=(
                f"[dry-run {methodology_name} v{i+1}]\n"
                f"Pain: {brief.pain}\nOffer: {brief.product}\nCTA: {', '.join(brief.ctas)}"
            ),
            description=f"[dry v{i+1}] {brief.product[:28]}",
            ctas=list(brief.ctas),
            confidence="medium",
            confidence_score=0.65,
            axes=VariantAxes(relevance=0.7, originality=0.6, brand_fit=0.75),
            reasoning=f"[dry v{i+1}] deterministic stub for CI",
        )
        for i in range(n)
    ]
    trace = f"[dry-run] methodology={methodology_name} n={n}"
    return AgentResult(
        run_id=run_id,
        variants=variants,
        trace=trace,
        trace_structured=[],
        methodology=methodology_name,
        model=DRY_RUN_MODEL_TAG,
        pipeline_version="copy_generation@dry-run",
        seed=None,
        created_at=datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


def _call_claude(methodology, user_prompt: str, n: int, model: str) -> AgentResult:
    from anthropic import Anthropic  # kept lazy so dry-run tests don't need the package

    client = Anthropic()
    system_text = methodology.system_prompt_path.read_text(encoding="utf-8")
    run_id = uuid.uuid4().hex[:8]
    started_at = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    response = client.messages.create(
        model=model, max_tokens=2048,
        system=[{"type": "text", "text": system_text, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": user_prompt}],
    )

    if not response.content or not hasattr(response.content[0], "text"):
        raise RuntimeError(f"Unexpected Claude response shape: {response!r}")
    block_type = getattr(response.content[0], "type", None)
    if block_type != "text":
        raise RuntimeError(
            f"Expected text block, got {block_type!r}; extended thinking not supported yet. "
            f"Full response: {response!r}"
        )
    raw = response.content[0].text.strip()

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"Claude returned non-JSON payload for methodology {methodology.name!r}:\n---\n{raw}\n---"
        ) from e

    if not isinstance(payload, list):
        raise RuntimeError(
            f"Claude response must be a JSON array, got {type(payload).__name__}: {raw!r}"
        )

    variants: list[CopyVariant] = []
    for i, v in enumerate(payload):
        missing = REQUIRED_VARIANT_FIELDS - v.keys()
        if missing:
            raise RuntimeError(
                f"Claude variant {i} missing required fields {sorted(missing)}: {v!r}\n"
                f"full payload: {raw!r}"
            )
        if v["confidence"] not in VALID_CONFIDENCE:
            raise RuntimeError(
                f"Claude variant {i} returned invalid confidence {v['confidence']!r}; "
                f"expected one of {sorted(VALID_CONFIDENCE)}.\nfull payload: {raw!r}"
            )
        score = v["confidence_score"]
        if not (isinstance(score, (int, float)) and 0.0 <= float(score) <= 1.0):
            raise RuntimeError(
                f"Claude variant {i} confidence_score {score!r} out of range [0,1]. payload: {raw!r}"
            )
        axes_raw = v["axes"]
        if not isinstance(axes_raw, dict):
            raise RuntimeError(
                f"Claude variant {i} axes must be an object, got {type(axes_raw).__name__}: {raw!r}"
            )
        for axis in ("relevance", "originality", "brand_fit"):
            a = axes_raw.get(axis)
            if not (isinstance(a, (int, float)) and 0.0 <= float(a) <= 1.0):
                raise RuntimeError(
                    f"Claude variant {i} axes.{axis}={a!r} out of range [0,1]. payload: {raw!r}"
                )
        if not isinstance(v["ctas"], list) or not all(isinstance(c, str) for c in v["ctas"]):
            raise RuntimeError(
                f"Claude variant {i} ctas must be list[str], got {v['ctas']!r}. payload: {raw!r}"
            )
        variants.append(CopyVariant(
            id=f"V{i+1}",
            headline=v["headline"],
            primary_text=v["primary_text"],
            description=v["description"],
            ctas=v["ctas"],
            confidence=v["confidence"],
            confidence_score=float(score),
            axes=VariantAxes(
                relevance=float(axes_raw["relevance"]),
                originality=float(axes_raw["originality"]),
                brand_fit=float(axes_raw["brand_fit"]),
            ),
            reasoning=v["reasoning"],
        ))

    trace = "\n".join(
        f"[{v['confidence']}/{v['confidence_score']:.2f}] {v['reasoning']}"
        for v in payload
    )
    return AgentResult(
        run_id=run_id,
        variants=variants,
        trace=trace,
        trace_structured=[],
        methodology=methodology.name,
        model=model,
        pipeline_version=_pipeline_version(),
        seed=None,
        created_at=started_at,
    )


def _pipeline_version() -> str:
    import subprocess
    try:
        sha = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT_DIR, text=True
        ).strip()
    except Exception:
        sha = "unknown"
    return f"copy_generation@{sha}"


def generate(
    brief: Brief,
    methodology: str,
    n: int = 3,
    model: str = DEFAULT_MODEL,
) -> AgentResult:
    """Generate N copy variants for the given brief under the chosen methodology."""
    m = by_name(methodology)
    # Invoke build_user_prompt early so NotImplementedError in NPQEL surfaces
    # before any API call or dry-run path.
    user_prompt = m.build_user_prompt(brief, n=n)

    if _is_dry_run():
        return _dry_run_variants(brief, methodology_name=methodology, n=n)
    return _call_claude(m, user_prompt, n=n, model=model)
