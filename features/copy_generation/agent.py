"""Copy generation agent — `claude` CLI wrapper with dry-run mode.

Modes (resolved by environment):
  - dry-run: VIBEWEB_DRY_RUN=1  OR  (ANTHROPIC_API_KEY unset AND CLAUDE_CODE_OAUTH_TOKEN unset)
  - real:   any of ANTHROPIC_API_KEY / CLAUDE_CODE_OAUTH_TOKEN set AND VIBEWEB_DRY_RUN unset (or != 1)

Dry-run returns deterministic stub variants so tests and local dev cost zero
tokens. Real mode shells out to the `claude` CLI (npm package
@anthropic-ai/claude-code) with --output-format json; no streaming, no retry
loop — failures raise verbose to make their cause obvious.

Why subprocess and not the Python SDK: the Anthropic SDK only accepts API keys
(`sk-ant-api*`). We use OAuth tokens (`sk-ant-oat*`) via CLAUDE_CODE_OAUTH_TOKEN,
which only the CLI knows how to route through claude.ai. Same pattern as
paperweight (~/Developer/agents).
"""
from __future__ import annotations

import datetime
import json
import os
import subprocess
import uuid
from pathlib import Path
from typing import Any, Iterator

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

_CLI_TIMEOUT_SECONDS = 120


def _is_dry_run() -> bool:
    if os.getenv("VIBEWEB_DRY_RUN") == "1":
        return True
    if not os.getenv("ANTHROPIC_API_KEY") and not os.getenv("CLAUDE_CODE_OAUTH_TOKEN"):
        return True
    return False


def _build_cli_env() -> dict[str, str]:
    """Clone os.environ and strip API-key vars that would shadow the OAuth token.

    Claude CLI picks ANTHROPIC_API_KEY/ANTHROPIC_AUTH_TOKEN over
    CLAUDE_CODE_OAUTH_TOKEN when present, even if they're empty or stale. When
    we have a valid OAuth token (`sk-ant-oat*`), unconditionally drop the
    API-key vars so the CLI routes through claude.ai instead of failing with
    "invalid API key". Mirrors paperweight's _build_env_override.
    """
    env = dict(os.environ)
    oauth = env.get("CLAUDE_CODE_OAUTH_TOKEN", "")
    if oauth.startswith("sk-ant-oat"):
        env.pop("ANTHROPIC_API_KEY", None)
        env.pop("ANTHROPIC_AUTH_TOKEN", None)
        return env
    for key in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"):
        if key in env and not env[key]:
            del env[key]
    return env


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


def _run_cli(cmd: list[str], env: dict[str, str]) -> subprocess.CompletedProcess:
    """Thin subprocess wrapper — the mock surface for tests."""
    return subprocess.run(
        cmd, capture_output=True, text=True, env=env, timeout=_CLI_TIMEOUT_SECONDS,
    )


def _spawn_cli(cmd: list[str], env: dict[str, str]) -> subprocess.Popen:
    """Thin Popen wrapper — mock surface for streaming tests (parallel to _run_cli)."""
    return subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, bufsize=1, env=env,
    )


def _parse_cli_envelope(
    envelope: dict,
    methodology,
    model: str,
    *,
    run_id: str | None = None,
    started_at: str | None = None,
) -> AgentResult:
    """Parse a claude CLI result envelope into an AgentResult.

    Shared by _call_claude (json output) and _stream_claude (stream-json final
    envelope, Task 9b) — same envelope shape. Callers that know the subprocess
    start time should pass run_id + started_at to keep timing accurate;
    defaults mint fresh values at parse time.
    """
    run_id = run_id or uuid.uuid4().hex[:8]
    started_at = started_at or datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    if envelope.get("is_error"):
        raise RuntimeError(
            f"claude CLI reports is_error=true for methodology {methodology.name!r}: "
            f"subtype={envelope.get('subtype')!r} result={envelope.get('result')!r}"
        )

    raw = envelope.get("result", "").strip()
    if not raw:
        raise RuntimeError(
            f"claude CLI returned empty result for methodology {methodology.name!r}. "
            f"full envelope: {envelope!r}"
        )

    # Strip outer markdown fence if present — model sometimes ignores the
    # "no markdown fences" directive in the system prompt. Only consume the
    # closing fence when the opening fence was actually consumed (newline
    # after it); otherwise fall through to json.loads which will raise with
    # the full payload visible.
    if raw.startswith("```"):
        first_newline = raw.find("\n")
        if first_newline != -1:
            raw = raw[first_newline + 1:]
            if raw.endswith("```"):
                raw = raw[:-3].rstrip()

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
        f"[{v.confidence}/{v.confidence_score:.2f}] {v.reasoning}"
        for v in variants
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


def _call_claude(methodology, user_prompt: str, n: int, model: str) -> AgentResult:
    system_text = methodology.system_prompt_path.read_text(encoding="utf-8")

    cmd = [
        "claude", "-p", user_prompt,
        "--append-system-prompt", system_text,
        "--output-format", "json",
        "--model", model,
    ]
    completed = _run_cli(cmd, _build_cli_env())

    if completed.returncode != 0:
        raise RuntimeError(
            f"claude CLI exited {completed.returncode} for methodology {methodology.name!r}. "
            f"stderr: {completed.stderr!r}\nstdout: {completed.stdout!r}"
        )

    try:
        envelope = json.loads(completed.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"claude CLI returned non-JSON wrapper for methodology {methodology.name!r}:\n---\n"
            f"{completed.stdout}\n---"
        ) from e

    return _parse_cli_envelope(envelope, methodology, model)


def _stream_claude(methodology, user_prompt: str, n: int, model: str) -> Iterator[tuple[str, Any]]:
    """Yield ('token', str) during stream, then ('result', AgentResult) at end.

    Spawns `claude -p … --output-format stream-json --include-partial-messages --verbose`
    and iterates stdout line-by-line so tokens surface as soon as the CLI emits them.
    Raises RuntimeError with full CLI context on any CLI or parse failure — no
    silent fallbacks (CLAUDE.md §2.7).
    """
    system_text = methodology.system_prompt_path.read_text(encoding="utf-8")
    run_id = uuid.uuid4().hex[:8]
    started_at = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    cmd = [
        "claude", "-p", user_prompt,
        "--append-system-prompt", system_text,
        "--output-format", "stream-json",
        "--include-partial-messages", "--verbose",
        "--model", model,
    ]

    final_envelope: dict | None = None
    with _spawn_cli(cmd, _build_cli_env()) as proc:
        assert proc.stdout is not None  # PIPE set above — narrows for type-checkers
        for raw in proc.stdout:
            raw = raw.strip()
            if not raw:
                continue
            try:
                event = json.loads(raw)
            except json.JSONDecodeError as e:
                raise RuntimeError(
                    f"claude stream emitted non-JSON line for methodology "
                    f"{methodology.name!r}: {raw!r}"
                ) from e
            etype = event.get("type")
            if etype == "stream_event":
                inner = event.get("event", {})
                if inner.get("type") == "content_block_delta":
                    delta = inner.get("delta", {})
                    if delta.get("type") == "text_delta":
                        text = delta.get("text", "")
                        if text:
                            yield ("token", text)
            elif etype == "result":
                final_envelope = event
        try:
            proc.wait(timeout=_CLI_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired as e:
            proc.kill()
            raise RuntimeError(
                f"claude stream timed out after {_CLI_TIMEOUT_SECONDS}s "
                f"for methodology {methodology.name!r}"
            ) from e
        if proc.returncode != 0:
            stderr = proc.stderr.read() if proc.stderr else ""
            raise RuntimeError(
                f"claude CLI stream exited {proc.returncode} for methodology "
                f"{methodology.name!r}. stderr: {stderr!r}"
            )

    if final_envelope is None:
        raise RuntimeError(
            f"claude stream finished without a 'result' envelope for "
            f"methodology {methodology.name!r}"
        )
    yield ("result", _parse_cli_envelope(
        final_envelope, methodology, model,
        run_id=run_id, started_at=started_at,
    ))


def _pipeline_version() -> str:
    try:
        sha = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT_DIR, text=True
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
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
