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

- **Dry-run is the default in tests.** `_is_dry_run()` returns True when
  `VIBEWEB_DRY_RUN=1` OR `ANTHROPIC_API_KEY` is unset. Never write tests that
  assume the real API is reachable without explicit opt-in.
- **NPQEL is a stub.** Calling `generate(..., methodology="npqel")` ALWAYS
  raises `NotImplementedError`, even in dry-run. This is intentional — there
  is no dry-run output for an undefined framework.
- **No silent fallbacks.** Malformed Claude responses raise with the raw
  payload embedded in the error. Do not catch-and-default.
- **Model routing.** Default is `claude-sonnet-4-6` per the root CLAUDE.md.
  Callers may override via the `model=` parameter; no automatic tier switch.
