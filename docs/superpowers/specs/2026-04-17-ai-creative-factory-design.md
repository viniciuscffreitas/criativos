# AI Creative Factory — Design Spec

**Date:** 2026-04-17
**Status:** Approved (user delegated autonomy; design locked for execution)
**Scope:** Transform the current deterministic PNG renderer into an LLM-driven creative factory with web GUI for a non-technical marketing partner.

---

## 1. Context

The current pipeline (`scripts/build.py --all`) produces 21 deterministic PNGs from fixed HTML templates with copy hardcoded inline. It works for one brand (Vibe Web), it requires a developer to edit HTML for any copy change, and it has no variation mechanism.

The target state is an **agentic creative factory**: a non-technical partner uploads screenshots and picks a copywriting methodology → an LLM generates N copy variants using that methodology's framework → the renderer produces a batch of ads ready for Meta Ads Manager.

Today is mono-tenant (Vibe Web). Multi-client is explicitly deferred.

---

## 2. Goals and non-goals

### Goals
- Copy no longer lives inside HTML. Configurable per ad. Partner can edit without touching templates.
- LLM agent generates copy using pluggable methodology frameworks (PAS, NPQEL, others).
- A/B orchestration: 1 creative brief → N variants (configurable, default 3 headlines).
- Web GUI: upload assets, pick methodology, see variants, download batch.
- Agent output carries **confidence signal** + **chain-of-thought trace**.
- Foundation for Meta Marketing API integration (read first, write later).
- Respect AI-first principles from `CLAUDE.md`: vertical slices, verbose entry-points, DAMP-where-unstable, closed-loop verification.

### Non-goals (explicitly deferred)
- Google Ads / Display Network formats.
- Multi-tenant (projects per client).
- Full Meta Marketing API write operations in the first spec pass.
- Fine-tuned model per methodology — start with prompting only.
- Deployment / hosting. Runs locally for now.

---

## 3. Architecture — vertical slices

```
features/
  copy_generation/            # LLM agent — methodology-driven copy variants
    agent.py                  # entry-point
    methodologies/
      pas.py                  # Problem-Agitate-Solution (live)
      npqel.py                # placeholder — user defines the framework
      __init__.py
    prompts/
      system.md               # base system prompt
      pas.md                  # PAS-specific template
      npqel.md                # NPQEL placeholder
    schema.py                 # pydantic-ish types for input/output
    test_agent.py
    __init__.py
    CLAUDE.md

  creative_rendering/         # FUTURE: Playwright pipeline moves here
    (not migrated in this spec — stays in scripts/ + ads/ for now)

  ab_variation/               # FUTURE: batch orchestrator
  web_gui/                    # FUTURE: FastAPI + HTMX
  meta_integration/           # FUTURE

config/
  ads.yaml                    # all 6 ad briefs in structured form
  methodologies/              # per-ad methodology override
```

### Migration staging

**This spec (Spec 1) implements only:**
- `config/ads.yaml` with copy extracted from all 6 ad templates.
- Jinja2 template rendering (`ads/templates/*.html` become `.html.j2`).
- `features/copy_generation/` skeleton with PAS methodology + Claude API client (wired but behind env var check so tests don't need API keys).
- Tests + visual regression parity.

**Future specs:**
- Spec 2: A/B variation orchestrator + migration of `scripts/` + `ads/` to `features/creative_rendering/`.
- Spec 3: Web GUI (FastAPI + HTMX).
- Spec 4: Meta Marketing API integration.

---

## 4. Data model

### `config/ads.yaml` — structured copy

```yaml
ads:
  01_portfolio_grid:
    id: "01"
    slug: portfolio-grid
    methodology: pas           # default methodology if agent regenerates
    brief:                     # what the agent receives to generate copy
      product: "Custom websites from €450 in 7 days"
      audience: "European freelancers without a website"
      pain: "Losing clients to competitors with real sites"
      social_proof: "6 sites built last month"
      cta: "Message me"
    copy:                      # current copy (editable without regenerating)
      headline: "6 Sites Last Month. Yours Next?"
      primary_text: |
        Freelancers without a website lose clients every single day...
      description: "Custom sites from €450. 7 days."
    variants: []               # populated after agent run
    trace:                     # chain-of-thought from the agent
      last_run: null
      confidence: null         # ✅ / ⚠️ / 🔴
```

### Agent input/output contract

```python
# features/copy_generation/schema.py
@dataclass
class Brief:
    product: str
    audience: str
    pain: str
    social_proof: str | None
    cta: str

@dataclass
class CopyVariant:
    headline: str
    primary_text: str
    description: str
    confidence: Literal["high", "medium", "low"]  # maps to ✅/⚠️/🔴

@dataclass
class AgentResult:
    variants: list[CopyVariant]
    trace: str                 # chain-of-thought
    methodology: str
    model: str                 # e.g. "claude-sonnet-4-6"
```

---

## 5. LLM agent contract

- **Provider:** Anthropic (Claude API).
- **Default model:** `claude-sonnet-4-6` (per `CLAUDE.md` model routing: implementation/writing-default tier).
- **Prompt caching:** system prompt (methodology framework) is cached to reduce cost across the 6 ads.
- **Structured output:** JSON mode — agent returns list of `CopyVariant`s.
- **Trace:** `<thinking>` block captured, stored in the YAML entry as `trace.last_run`.
- **Confidence signal:** the LLM rates each variant's alignment to the methodology; human/reviewer can use as a review priority filter.
- **Dry-run mode:** if `ANTHROPIC_API_KEY` is unset OR `VIBEWEB_DRY_RUN=1`, agent returns deterministic mock variants so tests and local dev work without spending tokens.

### System prompt structure

```
You are a senior direct-response copywriter.
Methodology: {methodology_name}
Framework: {methodology_description_from_file}

Input brief:
{brief as JSON}

Generate {n_variants} distinct copy variants...
For each variant output: headline (max X chars), primary_text (max Y chars), description (max Z chars), confidence (high/medium/low + 1-line rationale).
```

---

## 6. Methodologies

### PAS — Problem, Agitate, Solution (live)

Prompt template `prompts/pas.md`:
- **Problem:** surface the audience's current pain in one sentence.
- **Agitate:** amplify consequence (cost of inaction).
- **Solution:** your offer as the resolution. CTA.
- Already documented in `ads/copy.md` — extract and formalize.

### NPQEL — placeholder

**Not yet defined.** User cited this acronym without expanding it. Handled via the methodology interface so a concrete framework can be added later without core changes.

Interface contract (every methodology file must expose):
```python
# features/copy_generation/methodologies/base.py
class Methodology(Protocol):
    name: str
    description: str           # short — surfaces in UI
    system_prompt_path: Path   # prompts/{name}.md
    def build_user_prompt(self, brief: Brief, n: int) -> str: ...
```

`prompts/npqel.md` exists as an empty-stub; when user defines NPQEL, it's a one-file drop-in.

---

## 7. A/B variation (Spec 2, foreshadowed here)

Default: **3 headline variants × 1 body × 1 description = 3 ads per brief**.

Configurable per-brief in `config/ads.yaml`:
```yaml
variants_per_run: 3
```

Orchestrator will produce `ads/renders/01-portfolio-grid-v1.png`, `...-v2.png`, `...-v3.png`.

---

## 8. GUI (Spec 3, foreshadowed)

**Stack decision (locked):** FastAPI + HTMX + Jinja2.

Rationale:
- Python-native — no JS toolchain to maintain.
- HTMX = server-rendered HTML with partial updates; zero npm, zero bundler.
- Same Jinja2 template engine used for ad rendering — shared mental model.
- Single binary deploy possible (uvicorn). Partner runs one command locally.
- Claude Code agent is faster reasoning about Python than React/Next.js.

Alternatives rejected:
- **Next.js / React:** heavy, over-stack for 5 pages.
- **Streamlit:** fast but opinionated UI — bad for brand-specific factory that should look like *our* tool.

---

## 9. Testing strategy

Three layers (inherited from CLAUDE.md):
1. **Structural:** file exists, YAML parses, Jinja2 renders to valid HTML.
2. **Contract:** agent input/output schema, methodology interface.
3. **Visual regression:** existing 3 goldens must still match after Jinja2 migration.

Agent test uses dry-run mode — no real API calls in CI.

Integration test (manual for now): run with `ANTHROPIC_API_KEY` set, verify real variants generated.

---

## 10. Error handling

Per CLAUDE.md §2.7:
- No silent fallbacks. If methodology file missing → raise `FileNotFoundError` with path.
- If agent API returns malformed JSON → raise with raw response in the error message.
- If config entry missing required field → pydantic-level validation error, not a default.

---

## 11. Explicitly out-of-scope for Spec 1

- Implementing `features/ab_variation/` (Spec 2).
- Migration of `scripts/` + `ads/` to `features/creative_rendering/` (Spec 2).
- GUI (Spec 3).
- Meta API (Spec 4).
- Cost tracking / budget guards per generation run.
- Caching variants (regenerate always, for now).
