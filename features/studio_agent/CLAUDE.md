# features/studio_agent — agent context

Inherits from the root `CLAUDE.md` and `features/copy_generation/CLAUDE.md`.

## What this does

Conversational layer above `copy_generation` + `render_service`. Receives
a free-form prompt and produces a `StudioPlan` (category + template_id +
methodology + Brief + n_variants). The `orchestrator` then runs the plan
end-to-end with SSE streaming.

## Entry-points

- `planner.plan(request)` — sync; dry-run keyword routing or real CLI shell.
- `orchestrator.stream(request)` — async; yields SSE frames for the full
  planning → copy → render pipeline. Used by `web_gui/api/studio.py`.
- `orchestrator.render_one(category, template_id, n_variants)` — async
  generator that wraps `render_service.render_*` and yields per-file
  `progress` events plus a final `done` event with the RenderReport.

## Non-obvious constraints

- **Dry-run plan is deterministic by keyword** (planner._CATEGORY_KEYWORDS).
  This keeps tests stable without CLI access. Real-mode is the only path
  doing semantic intent matching.
- **Plan is one-shot per request in v1.** No back-and-forth; if the prompt
  is ambiguous, plan() defaults to `meta-ads/01-portfolio-grid/pas` rather
  than asking the user. They can refine and resend.
- **`plan()` is sync; orchestrator wraps it in `asyncio.to_thread`.** The
  CLI is a blocking subprocess; running it on the loop thread would freeze
  every other client. Same applies to `agent_generate`.
- **`render_progress` events carry `url` only when `status="ok"`.** UIs
  should treat missing url as "still rendering / not on disk yet."
- **`token` events for the copy phase carry `node_id="copy"`.** The
  existing copy_generation streamer (`features/copy_generation/streaming.py`)
  uses `"agent"` — both coexist; UIs route by node_id, not by event name.
- **Per-file render progress is post-hoc in v1.** `render_service` blocks
  on Playwright until the report is complete; the orchestrator iterates
  the report after the fact. True per-file streaming during the render
  is a v2 follow-up (would need `run_jobs` to emit progress).

## Mock surface for tests

Monkeypatch the high-level boundaries:
- `features.studio_agent.orchestrator.plan` — to fake a StudioPlan
- `features.studio_agent.orchestrator.agent_generate` — to fake an AgentResult
- `features.studio_agent.orchestrator.render_one` — to fake the render generator
- `features.studio_agent.planner._run_cli` — only when exercising planner CLI

Avoid monkeypatching `subprocess.run` directly: `_run_cli` is the layered
boundary so `_pipeline_version()`'s git rev-parse stays unintercepted.
