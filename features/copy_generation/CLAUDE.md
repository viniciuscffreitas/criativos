# features/copy_generation — agent context

Inherits from the root `CLAUDE.md`. This file adds feature-specific rules.

## What this does

Generates N copy variants (`CopyVariant`) for a `Brief` using a pluggable
`Methodology` (PAS/AIDA/BAB live; NPQEL stubbed). Output is an `AgentResult`
carrying variants + chain-of-thought trace + methodology tag + model used.

## Inputs / outputs

- Input: `Brief` (dataclass — see `schema.py`). In Spec 1, Briefs come from
  `config/ads.yaml → ads.<key>.brief`. Future specs may source elsewhere.
- Output: `AgentResult`. In Spec 1, results are returned in-process; no disk
  write yet. Spec 2 will persist to `ads.<key>.variants` in the YAML.

## Non-obvious constraints

- **Real mode shells out to the `claude` CLI.** `_call_claude` invokes
  `claude -p <prompt> --append-system-prompt <sys> --output-format json --model <m>`
  and parses the `result` field of the JSON envelope. The Anthropic Python
  SDK is not used — it only accepts API keys, and we authenticate with
  `CLAUDE_CODE_OAUTH_TOKEN` (sk-ant-oat*) which only the CLI knows how to
  route. Runtime dep: `npm i -g @anthropic-ai/claude-code` (baked into the
  Dockerfile).
- **Mock surface for tests is layered.** For tests that exercise the
  CLI subprocess boundary directly, monkeypatch
  `features.copy_generation.agent._run_cli` (blocking) or
  `features.copy_generation.agent._spawn_cli` (stream-json) — not
  `subprocess.run` / `subprocess.Popen` directly, so `_pipeline_version()`'s
  `git rev-parse` call isn't intercepted. For tests in
  `features/copy_generation/test_streaming.py` that exercise SSE frame
  shape/ordering without caring about wire format, monkeypatch the
  higher-level generator `features.copy_generation.streaming._stream_claude`
  instead.
- **Dry-run is the default in tests.** `_is_dry_run()` returns True when
  `VIBEWEB_DRY_RUN=1` OR (both `ANTHROPIC_API_KEY` and
  `CLAUDE_CODE_OAUTH_TOKEN` are unset). Never write tests that assume the
  real API is reachable without explicit opt-in.
- **Empty auth env vars are stripped before subprocess.** `_build_cli_env`
  drops empty `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` entries — Claude
  CLI treats "" as a credential and fails instead of falling back to
  `CLAUDE_CODE_OAUTH_TOKEN`.
- **NPQEL is a stub.** Calling `generate(..., methodology="npqel")` ALWAYS
  raises `NotImplementedError`, even in dry-run. This is intentional — there
  is no dry-run output for an undefined framework.
- **No silent fallbacks.** Malformed CLI responses raise with the raw
  payload embedded in the error. `is_error=true` in the CLI envelope is
  surfaced as RuntimeError. Do not catch-and-default.
- **Model routing.** Default is `claude-sonnet-4-6` per the root CLAUDE.md.
  Callers may override via the `model=` parameter; no automatic tier switch.
