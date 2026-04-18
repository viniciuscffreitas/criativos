# Spec 3 — Web GUI (design handoff → working app)

**Status:** v2 · pending user approval
**Supersedes:** Spec 1 doc §8 (stack locked on FastAPI + HTMX + Jinja2)
**Design bundle:** `docs/superpowers/design-bundles/criativos-2026-04-18/`
**Implements:** `features/web_gui/` as vertical slice per CLAUDE.md §2.1

---

## 1. Stack decision (overrides Spec 1 §8)

Re-opened after design handoff. AI-First handbook (user's doctrine) prioritizes verbose entry-points, zero jump-tax, one-file-per-component, IA reads tracebacks as maps. HTMX partial-swap imposes jump-tax at every interaction (handler → fragment → swap); a colocated React component with full state visible in one file has lower agent cognitive load.

**Adopted**: Vite + React 18 + TypeScript for UI, FastAPI for backend. Single vertical slice at `features/web_gui/`.

Rejected alternatives:
- **HTMX + Jinja2** (Spec 1 §8): cannot cleanly deliver the 5-step flow with real streaming + Cmd+K palette + tweaks panel without Alpine.js or vanilla JS glue that defeats the "Python-native" rationale.
- **Next.js**: over-stack for 5 pages; SSR not needed for a local tool.
- **Streamlit**: visually rigid, can't hit 1:1 parity with the design.

---

## 2. Vertical slice layout

```
features/web_gui/
  __init__.py
  server.py                     # FastAPI app — verbose route registration, no magic
  settings.py                   # Env parsing (port, dev proxy target, upload dir)
  api/
    __init__.py
    projects.py                 # /api/v1/projects, /api/v1/projects/{slug}
    briefs.py                   # /api/v1/projects/{slug}/ads/{ad_id}/brief  [GET, PUT]
    creatives.py                # /api/v1/projects/{slug}/creatives
    generate.py                 # /api/v1/generate  +  /api/v1/generate/stream (SSE)
    variants.py                 # /api/v1/variants/{run_id}/{variant_id}  [PATCH]
    traces.py                   # /api/v1/traces/{run_id}
    assets.py                   # /api/v1/assets/upload
    serializers.py              # YAML ↔ JSON adapters (Brief, Creative, Variant)
  services/
    project_store.py            # Reads/writes config/projects.yaml + config/ads.yaml
    trace_store.py              # Structured traces persisted at features/web_gui/traces/<run_id>.json
    asset_store.py              # Uploaded files at features/web_gui/uploads/<project_slug>/
    yaml_rw.py                  # Atomic read-modify-write with fcntl.flock
  ui/
    package.json                # react, react-dom, vite, typescript, vitest — locked
    vite.config.ts
    tsconfig.json
    index.html
    src/
      main.tsx
      App.tsx
      tokens.ts                 # Mirrors brand/tokens.css (build-time diff check)
      api.ts                    # Typed fetch wrappers + EventSource consumer
      types.ts                  # Matches api/serializers.py shapes
      components/
        DesktopChrome.tsx
        Sidebar.tsx
        FlowView.tsx
        flow/
          Setup.tsx
          Generate.tsx           # SSE consumer
          Review.tsx             # Variant cards + confidence + trace
          Export.tsx
        Gallery.tsx
        DetailPanel.tsx
        CommandPalette.tsx
        TweaksPanel.tsx          # Static in MVP; renders but doesn't mutate
        BrandLibrary.tsx
        GenerationTraceModal.tsx
        icons.tsx                # 1:1 from design icons.jsx
      data/
        creatives.ts             # Bridges to /api/v1/projects/{slug}/creatives
        brief.ts                 # Bridges to /api/v1/projects/{slug}/ads/{id}/brief
        projects.ts              # Bridges to /api/v1/projects
  static/                        # vite build output — FastAPI serves StaticFiles here
  traces/                        # .gitignored — structured trace JSON per run
  uploads/                       # .gitignored — user asset uploads
  test_server.py                 # pytest — API contract, YAML persistence, streaming
  test_serializers.py            # pytest — shape conversions
  test_ui_e2e.py                 # playwright — closed-loop visual verification
  CLAUDE.md                      # feature-scoped rules
```

**Spec 2 boundaries unchanged**: `ads/`, `brand/`, `scripts/` stay where they are for Spec 3. Web GUI reads from their current paths.

---

## 3. Decisions locked (user-confirmed 2026-04-18)

| # | Question | Decision | Impact |
|---|---|---|---|
| 1 | Multi-project schema? | **Yes, open schema list for N** | New `config/projects.yaml`, `Project` entity, sidebar reads list |
| 2 | Review screen golden: dry-run or real? | **Real snapshot** | ~$0.08 lifetime cost (≤10 recordings). CI uses dry-run fallback when no key. |
| 3 | Brief form writes back to `config/ads.yaml`? | **Yes** | `PUT /briefs/{ad_id}` with atomic yaml write (fcntl.flock) |

---

## 4. Data model changes

### 4.1 New: `config/projects.yaml`

```yaml
projects:
  vibeweb:
    slug: vibeweb
    name: "Vibe Web"
    description: "Agência web — freelancers EU"
    ads_path: config/ads.yaml
    renders_path: ads/renders/
    brand_path: brand/
    created_at: "2026-04-18T00:00:00Z"
```

Seed with `vibeweb` as the first project. Schema supports N projects; sidebar fetches list at startup.

### 4.2 Extended: `config/ads.yaml` per-ad schema

Adds these fields to each `ads.<key>`:

```yaml
ads:
  01_portfolio_grid:
    id: "01"
    slug: portfolio-grid
    kind: image                 # NEW: image | video | carousel | copy (Spec 3 MVP: always "image")
    placement: "Instagram Feed · 1:1"  # NEW: Meta placement descriptor
    format: "1080×1080 png"     # NEW: derived from kind + render size
    methodology: pas
    brief:
      product: "..."
      audience: "..."
      pain: "..."
      social_proof: "..."
      ctas: ["Message me"]      # CHANGED: was string, now array — migration required
    copy:
      hero: "I built"           # NEW: short visual subtitle (used in Gallery preview)
      # ... existing per-ad copy fields unchanged ...
    meta: { ... }
    variants: []                # Populated by /generate
    trace:
      last_run: null
      confidence: null
```

**Migration**: one-shot script `scripts/migrate_ads_yaml_v2.py` converts `brief.cta: str` → `brief.ctas: [str]` and adds `kind: image`, `placement`, `format`, `copy.hero` with sensible defaults derived from existing data. Guarded by `test_migration_idempotent` (running twice = no-op).

### 4.3 Extended: `CopyVariant` dataclass

```python
@dataclass
class CopyVariant:
    id: str                       # NEW: "V1".."Vn" (position in run)
    headline: str
    primary_text: str
    description: str
    ctas: list[str]               # NEW: replaces implicit single CTA
    confidence: Confidence        # "high" | "medium" | "low" — existing
    confidence_score: float       # NEW: 0.0–1.0 for UI
    axes: VariantAxes             # NEW: per-axis sub-scores
    selected: bool = False        # NEW: persisted approval state
    reasoning: str = ""           # NEW: exposed from Claude payload (was only in trace string)

@dataclass
class VariantAxes:
    relevance: float              # 0.0–1.0
    originality: float
    brand_fit: float

    @property
    def warn(self) -> str | None:
        """UI hint when any axis drops below threshold."""
        if min(self.relevance, self.originality, self.brand_fit) < 0.6:
            low = sorted([
                ("relevância", self.relevance),
                ("originalidade", self.originality),
                ("brand fit", self.brand_fit),
            ], key=lambda t: t[1])[0]
            return f"baixa {low[0]} ({low[1]:.2f})"
        return None
```

`confidence_symbol` property unchanged.

### 4.4 Extended: `AgentResult` dataclass

```python
@dataclass
class AgentResult:
    run_id: str                   # NEW: uuid4 hex[:8]
    variants: list[CopyVariant]
    trace: str                    # Existing: human-readable concat
    trace_structured: list[TraceNode]  # NEW: UI-friendly graph
    methodology: str
    model: str
    pipeline_version: str         # NEW: "copy_generation@<git_sha_short>"
    seed: int | None = None       # NEW: None in MVP (Claude API doesn't accept seed yet)
    created_at: str = ""          # NEW: ISO-8601 UTC

@dataclass
class TraceNode:
    id: str                       # "brief", "agent", "variant-1", etc
    label: str                    # "Briefing", "Agente criativo", "Variante 1"
    start_ms: int                 # Wall-clock ms since run start
    end_ms: int
    tokens: int                   # Actual LLM token count for this node
    confidence: float | None      # 0.0–1.0, None for non-LLM nodes
    output_preview: str           # First ~80 chars of output
```

### 4.5 Prompt updates (PAS)

`features/copy_generation/prompts/pas.md` extended to require JSON with:

```json
[
  {
    "headline": "...",
    "primary_text": "...",
    "description": "...",
    "ctas": ["..."],
    "confidence": "high|medium|low",
    "confidence_score": 0.87,
    "axes": {"relevance": 0.9, "originality": 0.7, "brand_fit": 0.85},
    "reasoning": "..."
  }
]
```

Agent-side validation: if new fields missing from a real API response → `RuntimeError` verbose (no defaulting). Dry-run stub emits all fields deterministically.

---

## 5. API contract (complete)

Base: `/api/v1`. Errors: `{ "error": "human-readable", "code": "MACHINE_READABLE", "raw": "..." }` per CLAUDE.md §2.7.

### 5.1 Projects

| Method | Path | Request | Response |
|---|---|---|---|
| `GET` | `/projects` | — | `{ projects: Project[] }` |
| `GET` | `/projects/{slug}` | — | `Project` |

Project shape:
```ts
interface Project {
  slug: string;
  name: string;
  description: string;
  ad_count: number;        // count of entries in ads_path
  variant_count: number;   // total variants across all ads
  created_at: string;
}
```

### 5.2 Briefs

| Method | Path | Request | Response |
|---|---|---|---|
| `GET` | `/projects/{slug}/ads/{ad_id}/brief` | — | `Brief` |
| `PUT` | `/projects/{slug}/ads/{ad_id}/brief` | `Brief` | `{ updated: true, brief: Brief }` |

Write is atomic (read-modify-write with fcntl.flock on the yaml file). 409 if concurrent write detected.

### 5.3 Creatives

| Method | Path | Request | Response |
|---|---|---|---|
| `GET` | `/projects/{slug}/creatives` | `?kind=image\|video\|carousel\|copy&status=ready\|streaming` | `{ creatives: Creative[] }` |

Creative shape (aligned with UI expectations):
```ts
interface Creative {
  id: string;                   // "{ad_slug}-{variant_index}" or "{ad_slug}-base"
  kind: "image" | "video" | "carousel" | "copy";
  title: string;                // Human label, e.g. "Portfolio Grid"
  placement: string;            // e.g. "Instagram Feed · 1:1"
  format: string;               // e.g. "1080×1080 png"
  headline: string;             // meta.headline
  body: string;                 // meta.primary_text
  hero: string;                 // copy.hero
  ctas: string[];               // brief.ctas
  thumbnail_url: string;        // "/renders/01-portfolio-grid.png" served as StaticFiles
  status: "ready" | "streaming" | "failed";
  ad_id: string;                // "01"
  variant_id: string | null;    // null = base meta copy, else "V1".."Vn"
}
```

`creative.bg` is **removed** — thumbnails are real PNGs served as static. DetailPanel renders `<img src={thumbnail_url}>` inside the iOS frame.

### 5.4 Generate (non-streaming)

| Method | Path | Request | Response |
|---|---|---|---|
| `POST` | `/generate` | `GenerateRequest` | `AgentResult` |

```ts
interface GenerateRequest {
  project_slug: string;
  ad_id: string;
  methodology: "pas" | "aida" | "bab" | "npqel";
  n_variants: number;           // default 3
  brief_overrides?: Partial<Brief>;   // if present, don't read from yaml
  persist: boolean;             // default true — writes variants back to ads.yaml
}
```

`aida`/`bab`/`npqel` → **501 Not Implemented** with verbose error: `{ "error": "Methodology 'aida' is stubbed; implement features/copy_generation/methodologies/aida.py to enable", "code": "METHODOLOGY_NOT_IMPLEMENTED" }`. UI shows the toggle disabled with tooltip until Spec 2.

### 5.5 Generate (SSE streaming)

| Method | Path | Request | Response |
|---|---|---|---|
| `POST` | `/generate/stream` | `GenerateRequest` | `text/event-stream` |

SSE events (order-sensitive):

```
event: run_start
data: {"run_id": "a1b2c3d4", "pipeline_version": "copy_generation@abc1234", "started_at": "..."}

event: node_start
data: {"node_id": "brief", "label": "Briefing", "start_ms": 0}

event: node_done
data: {"node_id": "brief", "end_ms": 42, "tokens": 0, "confidence": null, "output_preview": "..."}

event: node_start
data: {"node_id": "agent", "label": "Agente criativo", "start_ms": 42}

event: token
data: {"node_id": "agent", "text": "["}

event: token
data: {"node_id": "agent", "text": "{\"headline\":"}

... many token events ...

event: variant_done
data: {"variant_id": "V1", "headline": "...", "primary_text": "...", "confidence": "high", "confidence_score": 0.91, "axes": {...}, "reasoning": "..."}

event: node_done
data: {"node_id": "agent", "end_ms": 3421, "tokens": 512, "confidence": 0.87, "output_preview": "..."}

event: done
data: <AgentResult JSON>

event: error
data: {"error": "...", "code": "...", "raw": "..."}
```

Dry-run mode emits the same event sequence with deterministic stub tokens so the UI animation code path is **identical** (closed-loop testable offline).

### 5.6 Variants

| Method | Path | Request | Response |
|---|---|---|---|
| `PATCH` | `/variants/{run_id}/{variant_id}` | `{ selected?, headline?, primary_text?, description?, ctas? }` | Updated variant |

Persists back to `ads.<key>.variants[]` in yaml. Same atomic write as briefs.

### 5.7 Traces

| Method | Path | Request | Response |
|---|---|---|---|
| `GET` | `/traces/{run_id}` | — | `AgentResult` (full trace_structured inlined) |

Traces stored at `features/web_gui/traces/<run_id>.json`. 404 if not found.

### 5.8 Assets

| Method | Path | Request | Response |
|---|---|---|---|
| `POST` | `/assets/upload` | `multipart/form-data` files + `project_slug` | `[{ file_id, filename, size, kind }]` |

Files written to `features/web_gui/uploads/<project_slug>/<uuid>.<ext>`. MVP: no virus scan, no image processing. Listed as references in brief generation (URL injected into prompt) for v2.

---

## 6. UI → API wire map

For each GUI component, which endpoint(s) it consumes.

| Component | Calls | When |
|---|---|---|
| `App` (boot) | `GET /projects` | Mount — populates Sidebar |
| `Sidebar` | reads `App` state | No direct call |
| `Gallery` | `GET /projects/{slug}/creatives` | On `nav === 'gallery'` |
| `DetailPanel` | `GET /projects/{slug}/creatives/{id}` (or embedded in list) | On `selectedCreative` set |
| `BrandLibrary` | Reads static `/brand/tokens.css` + lists `/brand/logos/` via `GET /brand/assets` | On `nav === 'brand'` |
| `FlowView → Setup` | `GET /projects/{slug}/ads` (list existing briefs) | On step 0 mount |
| `FlowView → Setup` (save) | `PUT /projects/{slug}/ads/{id}/brief` | On "Próximo" |
| `FlowView → Generate` | `POST /generate/stream` via EventSource | On step 1 mount |
| `FlowView → Review` | Uses streamed variants from previous step | No extra call until selection |
| `FlowView → Review` (select/edit) | `PATCH /variants/{run_id}/{variant_id}` | On variant toggle/edit |
| `FlowView → Export` | `POST /render` (triggers `ads/render.py`) → returns zip URL | On "Baixar" |
| `GenerationTraceModal` | `GET /traces/{run_id}` | On open |
| `CommandPalette` | Calls App actions (navigation only in MVP) | On action selection |
| `TweaksPanel` | No backend call (static in MVP) | — |

---

## 7. MVP scope — what ships in Spec 3

### Shipping
- 3 views (flow / gallery / brand) with real data from backend
- 5-step flow: Setup → Generate (SSE streaming) → Review (variant select + edit) → Export
- DetailPanel with real thumbnails
- BrandLibrary read-only
- CommandPalette: nav-only (⌘1/2/3 work; ⌘K opens; action commands visible but no-op)
- Multi-project schema seeded with `vibeweb`
- Brief write-back to `config/ads.yaml`
- PAS methodology live; AIDA/BAB/NPQEL show disabled in UI with tooltip
- `kind: image` only (video/carousel/copy tabs empty with "em breve" placeholder)
- Dry-run parity: the entire app runs offline with `VIBEWEB_DRY_RUN=1`
- Closed-loop e2e: playwright test that drives the full flow

### Deferred (v2 / Spec 4)
- TweaksPanel interactivity (theme/accent/density mutations)
- ⌘I/⌘V/⌘L/⌘T/⌘P/⌘E command actions (hints remain, no-op)
- Drag-drop upload triggers real prompt injection (Spec 4)
- Meta Ads API publish (Spec 4)
- Live re-render on variant edit (waits for Spec 2 orchestrator)
- AIDA, BAB, NPQEL methodologies (each is a ~1h task — defer)
- Video/carousel/copy kinds (require new render pipelines)

---

## 8. Testing strategy (handbook §3 closed-loop)

### 8.1 Contract tests (`test_server.py`)
- Every endpoint in §5 has a test with real request shape → assert response shape matches `types.ts`
- YAML write tests: PUT brief → assert file mutated, then PUT again with same data → idempotent
- Concurrent write: two PUTs race on the same ad → second gets 409 (fcntl.flock verified)
- Methodology stubs: `POST /generate methodology=aida` → 501 with specific code

### 8.2 Streaming tests
- Dry-run SSE: connect to `/generate/stream`, collect all events, assert order is `run_start → node_start... → done`
- Malformed Claude response (mocked): SSE emits `event: error` with `raw` field, never silent

### 8.3 Serializer tests (`test_serializers.py`)
- `yaml_ad → Creative` round-trip for each of the 6 seed ads
- `CopyVariant ↔ JSON` roundtrip preserves all new fields (id, axes, ctas, etc)
- Migration script idempotency: run `migrate_ads_yaml_v2.py` twice, assert unchanged

### 8.4 Component tests (vitest, colocated)
- Each component mounts with typed fixture props → assertions on DOM text/attributes (no snapshot fuzz)
- SSE consumer: mocked EventSource emits deterministic events → assert React state converges

### 8.5 Token diff test
- `test_tokens_truth.py` extends: compares `brand/tokens.css --accent` vs `ui/src/tokens.ts.accent` → fail if drifted

### 8.6 Closed-loop e2e (`test_ui_e2e.py`)
- Boot: `uvicorn features.web_gui.server:app` + `vite preview` in fixtures
- `VIBEWEB_DRY_RUN=1` for CI; real Anthropic key in opt-in local test
- Sequence:
  1. Open root, assert Sidebar renders 1 project ("Vibe Web")
  2. ⌘2 → Gallery renders 6 cards with real thumbnails
  3. Click first card → DetailPanel opens with matching headline
  4. ⌘1 → Flow step 0 (Setup) renders brief form prefilled from ads.yaml
  5. Click "Próximo" → step 1 (Generate) shows streaming tokens for ~2s
  6. Step 2 (Review) renders 3 variant cards with confidence badges
  7. Click variant → PATCH persists; reload page → variant still selected
  8. Screenshot of Review screen → diff vs `tests/goldens/web-gui-review.png` (1% threshold like existing visual regression)

Golden for step 8 is generated **once** with real Anthropic key and committed. CI uses dry-run and compares against a **different** golden `tests/goldens/web-gui-review-dryrun.png` (also committed).

---

## 9. Dev & deploy

### Dev
```bash
python scripts/dev.py
# → uvicorn features.web_gui.server:app --reload --port 8000 (background)
# → cd features/web_gui/ui && npm run dev (foreground, port 5173)
# vite proxies /api/* → :8000
```

### Prod-local
```bash
cd features/web_gui/ui && npm run build
uvicorn features.web_gui.server:app --port 8000
# UI served from features/web_gui/static/, API at /api/v1/*
```

### CI
```bash
pytest features/web_gui/test_server.py features/web_gui/test_serializers.py -q
cd features/web_gui/ui && npm test -- --run
# e2e only with VIBEWEB_E2E=1 (requires playwright browsers)
```

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Visual regression flaky on font rendering | Golden generation forced through headless Chromium same as brand renders; threshold 1% same as existing suite |
| SSE connection drops mid-stream | Backend idempotent on retry — each `run_id` is uuid, reconnect creates new run (UI warns user) |
| `ads.yaml` corruption on concurrent write | `fcntl.flock` + backup: `ads.yaml.bak` written before each modify |
| Vite dep vulnerabilities (npm audit) | Lockfile committed; CI runs `npm audit --production` at moderate threshold |
| React + Anthropic SDK version drift | Both pinned in `pyproject.toml` and `package.json`; Dependabot watches |
| Design bundle uses oklch() not supported on old browsers | Target: modern evergreen (Chrome/Edge/Firefox latest); no IE support, this is a local desktop tool |

---

## 11. Non-obvious constraints (future agents: read this)

- **Babel-standalone from design bundle is dropped.** Everything goes through Vite's TS pipeline.
- **`oklch()` stays.** Modern browser target; tokens.ts exports them as strings passed to CSS.
- **Streaming is SSE, not websockets.** One-way is enough; SSE reconnects trivially.
- **Dry-run parity is load-bearing.** The UI code path must be identical in dry-run and real mode — no `if (dryRun)` branches in React components. Backend handles the fork.
- **`run_id` is canonical.** All variant/trace operations key on `run_id`, not position. Variants inserted into `ads.yaml` carry the `run_id` they came from.
- **Projects list is the source of truth for sidebar.** If `projects.yaml` has 0 entries, sidebar renders "Nenhum projeto — crie um" CTA (not ship in MVP, but schema supports it).
- **PEP 668 / homebrew Python reality**: dev deps install with `pip install --break-system-packages -e ".[dev,web]"` OR use a venv. Doc both in README.
- **Atalhos visuais vs funcionais**: command palette mostra ⌘I/⌘V/⌘L/⌘T/⌘P/⌘E mas só ⌘1/2/3/K/Esc estão wired. Os outros são hints visuais pro v2.

---

## 12. Explicitly out-of-scope for Spec 3

- `features/ab_variation/` orchestrator (Spec 2)
- Migration of `scripts/` + `ads/` into `features/creative_rendering/` (Spec 2)
- Meta Marketing API (Spec 4)
- Containerization / Docker (Spec 4)
- Video/carousel/copy render pipelines (requires new methodologies + templates)
- AIDA, BAB, NPQEL methodology implementations (separate Spec each, ~1h of prompt engineering)
- Persistent app state across machines (SQLite/Postgres) — everything is filesystem-backed for MVP
- Authentication (tool is local only; multi-user comes with Meta API integration in Spec 4)
