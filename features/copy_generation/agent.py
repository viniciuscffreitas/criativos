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

import json
import os

from features.copy_generation.methodologies import by_name
from features.copy_generation.schema import AgentResult, Brief, CopyVariant

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
    variants = [
        CopyVariant(
            headline=f"[{methodology_name.upper()} v{i+1}] {brief.pain[:30]}",
            primary_text=(
                f"[dry-run {methodology_name} v{i+1}]\n"
                f"Pain: {brief.pain}\n"
                f"Offer: {brief.product}\n"
                f"CTA: {brief.cta}"
            ),
            description=f"[dry v{i+1}] {brief.product[:28]}",
            confidence="medium",
        )
        for i in range(n)
    ]
    trace = (
        f"[dry-run] methodology={methodology_name} n={n}\n"
        f"brief.product={brief.product}\n"
        f"brief.pain={brief.pain}\n"
        "No API call made. Set ANTHROPIC_API_KEY and unset VIBEWEB_DRY_RUN for real output."
    )
    return AgentResult(
        variants=variants,
        trace=trace,
        methodology=methodology_name,
        model=DRY_RUN_MODEL_TAG,
    )


def _call_claude(
    methodology, user_prompt: str, n: int, model: str
) -> AgentResult:
    # Import lazily so dry-run tests don't need the anthropic package installed.
    from anthropic import Anthropic

    client = Anthropic()
    system_text = methodology.system_prompt_path.read_text(encoding="utf-8")

    # Ephemeral cache on the system prompt: PAS prompt is stable across runs
    # within a session; caching it cuts input-token cost after the first call.
    response = client.messages.create(
        model=model,
        max_tokens=2048,
        system=[{"type": "text", "text": system_text, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": user_prompt}],
    )

    if not response.content or not hasattr(response.content[0], "text"):
        raise RuntimeError(
            f"Unexpected Claude response shape: {response!r}"
        )
    block_type = getattr(response.content[0], "type", None)
    if block_type != "text":
        raise RuntimeError(
            f"Expected text block, got {block_type!r}; extended thinking not "
            f"supported yet. Full response: {response!r}"
        )
    raw = response.content[0].text.strip()

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"Claude returned non-JSON payload for methodology "
            f"{methodology.name!r}:\n---\n{raw}\n---"
        ) from e

    if not isinstance(payload, list):
        raise RuntimeError(
            f"Claude response must be a JSON array, got {type(payload).__name__}: {raw!r}"
        )

    variants: list[CopyVariant] = []
    for i, v in enumerate(payload):
        try:
            conf = v["confidence"]
            if conf not in VALID_CONFIDENCE:
                raise RuntimeError(
                    f"Claude variant {i} returned invalid confidence {conf!r}; "
                    f"expected one of {sorted(VALID_CONFIDENCE)}.\nfull payload: {raw!r}"
                )
            variants.append(CopyVariant(
                headline=v["headline"],
                primary_text=v["primary_text"],
                description=v["description"],
                confidence=conf,
            ))
        except KeyError as exc:
            raise RuntimeError(
                f"Claude variant {i} missing field {exc}: {v!r}\nfull payload: {raw!r}"
            ) from exc
    trace = "\n".join(
        f"[{v.get('confidence', '?')}] {v.get('reasoning', '')}" for v in payload
    )
    return AgentResult(
        variants=variants,
        trace=trace,
        methodology=methodology.name,
        model=model,
    )


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
