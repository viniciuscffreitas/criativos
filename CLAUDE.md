# Vibe Web — Codebase Conventions for AI Agents

This file is loaded into every agent session. It encodes **how** we build, not **what** we build.
The "what" lives in `docs/plans/` and `docs/superpowers/specs/`.

Read this in full before your first tool call.

---

## 1. What this project is

Brand identity + **AI-powered creative factory** for Vibe Web (web agency, Europe).

**Today:** Deterministic Playwright pipeline that renders 21 PNGs (6 Meta ads, 7 social assets, logos, favicons) from HTML/SVG templates with `brand/tokens.css` as the single source of truth for design.

**Direction:** LLM-driven copy generation with methodology selection (PAS, NPQEL, …), A/B variation orchestration, web GUI for a non-technical partner, eventual Meta Marketing API integration.

**Not a product yet** — mono-tenant (Vibe Web only). Multi-client support is explicitly deferred.

---

## 2. Codebase philosophy — AI-first

The primary reader of this codebase is an LLM agent. Humans review and approve. Optimize for agent reasoning without sacrificing human review quality.

### 2.1 Vertical slices over technical layering

Organize by **intent** (what feature does this serve?), not by **type** (is this a test? a script? a template?).

Target structure as features land:

```
features/
  copy_generation/
    agent.py                  entry-point (verbose, no magic)
    methodologies/            PAS, NPQEL, …
    prompts/
    test_agent.py             co-located with what it tests
    CLAUDE.md                 feature-specific context (inherits root)
  creative_rendering/
    pipeline.py
    templates/
    goldens/
    test_rendering.py
  asset_management/
  ab_variation/
  web_gui/
shared/                       ONLY what is demonstrably transversal
  tokens.css                  design tokens (currently brand/tokens.css)
  playwright_utils.py         to_file_url, document.fonts.ready
```

The current layout (`scripts/`, `ads/`, `brand/`, `tests/`) is transitional. It was organized by type — the anti-pattern this document rejects. Migration to vertical slices is a planned refactor, not retrofit-as-you-go.

**Rule:** when you create a new feature, create a new folder under `features/`. Do NOT add files under `scripts/` or `shared/` unless the content is demonstrably used by 2+ features.

### 2.2 No jump-tax — verbose entry-points

An agent reading `features/x/agent.py` should need to open at most 1-2 other files to fully understand what it does. Hidden orchestrators, universal factories, and deep inheritance trees are treated as cognitive debt.

- Prefer explicit wiring at entry-points over decorators that defer behavior.
- Duplicate a 5-line config block before hiding it behind a base class.
- Function that reads data should contain the SQL (or the URL, or the file path) — don't push it to `config.py` if it's only used here.

### 2.3 DAMP is contextual, not absolute

Descriptive + mockable beats clever + DRY **when the pattern is unstable**. When the pattern is proven invariant (used 3+ times, shape won't change), extract.

The handbook principle "DAMP over DRY" is a correction against premature abstraction, not a license for copy-paste. Rule of thumb:
- Duplicate twice before extracting.
- When extracting, name by what the code *does* in this domain, not by its technical shape (`score_headline_contrast` — not `PureFunction` or `TextAnalyzer`).

### 2.4 Tools are contracts, not improv

For one-off exploration: `bash` + Python REPL is fine.
For production automation (everything under `features/`): structured tools with typed inputs and documented outputs. No `os.system` in feature code, no shell-string construction, no implicit paths. The cost of a typed tool is paid once; the cost of debugging `shell=True` surprises is paid forever.

### 2.5 Closed-loop verification

Rendering and UI features must verify themselves visually, not just via dimensions or existence checks.

- Playwright screenshot + perceptual diff against golden (Pillow `ImageChops`) for every render path.
- For new UI (web GUI): automated browser test that asserts the expected element, color, or text is visible in the DOM.
- "Dimensions match" ≠ "correct output". The existing `_verify_outputs()` in `scripts/generate.py` is NOT sufficient as the sole check — goldens exist for a reason.

### 2.6 Progressive disclosure, not context dumping

When an agent needs to understand something, it should grep/read. Do NOT inject big walls of "background context" into prompts or docstrings — that just bloats every future context window.

- Short module docstrings (1-3 lines) that anchor the WHY.
- No repeated explanations of "what this project is" in every file.
- Detailed context lives in `docs/` and is discovered on demand.

### 2.7 Errors are maps — verbose and technical

Never suppress a traceback, wrap an exception in a generic `RuntimeError("failed")`, or return a silent `None` on error.

- Re-raise with context: `raise RuntimeError(f"render_job failed for {job.source.name}") from e`
- Log the full chain. The agent reads stacktraces as repair maps.
- Silent fallbacks (e.g., "font didn't load → use sans-serif") are banned without an explicit log + configurable fail-fast flag.

### 2.8 AI-UX: confidence + traces

Every LLM-generated artifact (copy variant, A/B suggestion, methodology pick) must carry:
- **Confidence signal** (`✅` / `⚠️` / `🔴` or equivalent) that surfaces in the GUI and logs.
- **Chain-of-thought trace** stored alongside output. The reasoning is more valuable than the output — it lets a reviewer (human or agent) understand intent, not just symptom.

### 2.9 Cleanliness is functional, not cosmetic

Dead code reduces agent search space and hallucination risk.

- Deleted orphan artifacts (e.g., `vibeweb-logo-hd.png`) are a feature, not an aesthetic choice.
- Unused imports / dead branches get pruned the moment they're identified.
- The guard tests that enforce "every output has a producer" (see `tests/test_generate.py::test_no_orphan_logo_pngs`) extend to new file categories.

---

## 3. Hard conventions

| Rule | Threshold | Enforcement |
|---|---|---|
| File length | >400 lines = warning, >600 = split | devflow config |
| Test colocation | Tests live next to the feature (`features/x/test_x.py`) for new work; `tests/` is legacy | Migrated as features move |
| Tokens as truth | No hex literals for tokenized colors in CSS context | `tests/test_tokens_truth.py` |
| Tracebacks | Never suppressed; always re-raised with context | Code review |
| Commit atomicity | One behavior per commit | git log discipline |
| No TODO without issue | Every TODO has a Linear/GitHub link | grep check |
| TDD where behavior exists | RED → GREEN → REFACTOR | devflow spec flow |

---

## 4. How to work here as an agent

### Before any implementation
- Run `/spec` for non-trivial work. Follow the Plan → Approve → TDD → Verify → Review flow.
- For user-facing UI: invoke `frontend-design:frontend-design` BEFORE coding.
- For destructive ops (delete, reset, migrate): `devflow:wizard`.

### When writing a new feature
1. Create `features/<feature>/` with own entry-point, tests, CLAUDE.md.
2. Add a short `features/<feature>/CLAUDE.md` with: what this feature does, one sentence; its inputs and outputs; non-obvious constraints.
3. Tests colocate. Do NOT add to `tests/`.
4. If you need something from another feature, it goes through the other feature's entry-point — not through imports of its internals.

### When modifying existing code
- Current layout is transitional (see §2.1). You may encounter files in `scripts/`, `ads/`, `brand/`. If you touch one meaningfully, ask whether it should be moved to `features/` as part of this change.
- Run full verify (`pytest -q && python scripts/build.py --all`) before claiming done.
- Review Gate (`pr-review-toolkit:review-pr`) is mandatory before declaring a non-trivial task complete.

### Disagreeing with this document
If a principle here conflicts with the task or with newer evidence, say so in the turn — don't silently ignore. This file is authoritative until explicitly revised, but not infallible.

---

## 5. Current state (snapshot — may drift; trust `git log` + code over this)

- `scripts/pipeline.py` — shared Playwright helpers
- `scripts/generate.py` — brand asset generator (logos, social, favicons)
- `scripts/build.py` — unified CLI (`--brand` / `--ads` / `--all`)
- `ads/render.py` — ad renderer (thin wrapper over pipeline)
- `ads/templates/*.html` — 6 ad creatives
- `brand/` — tokens.css, logos, guidelines, social templates
- `tests/` — 141 tests: structural + tokens-truth + visual-regression

## 6. What's planned (read `docs/plans/` and `docs/superpowers/specs/` for active specs)

- Copy-as-config (extract hardcoded copy from HTML into structured config)
- LLM copy generator (PAS, NPQEL, …)
- A/B variation orchestration
- Web GUI for the non-technical partner
- Meta Marketing API integration (read → write)
