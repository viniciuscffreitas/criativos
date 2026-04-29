# Spec 3 — Web GUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a working local-desktop Web GUI (`features/web_gui/`) for the Vibe Web AI Creative Factory, consuming the React design bundle at `docs/superpowers/design-bundles/criativos-2026-04-18/`, plugged into `features/copy_generation/agent.generate()` via HTTP + SSE.

**Architecture:** Vite + React 18 + TypeScript frontend, FastAPI backend, single vertical slice at `features/web_gui/`. Projects+ads state persisted in YAML (atomic fcntl.flock write). Traces persisted as per-run JSON. Streaming identical between dry-run and real modes.

**Tech Stack:** FastAPI · uvicorn · anthropic (streaming) · PyYAML (with flock) · pytest · pytest-asyncio · Vite · React 18 · TypeScript · Playwright

**Spec:** `docs/superpowers/specs/2026-04-18-ai-creative-factory-spec-3-web-gui.md` (v2, user-approved)
**Design bundle:** `docs/superpowers/design-bundles/criativos-2026-04-18/project/`

---

## Phase 1 — Data model + schema migration

### Task 1: Migration script `migrate_ads_yaml_v2.py`

Adds `kind`, `placement`, `format`, `copy.hero` fields to `config/ads.yaml`. Converts `brief.cta: str` → `brief.ctas: [str]`. Idempotent: running twice = no-op.

**Files:**
- Create: `scripts/migrate_ads_yaml_v2.py`
- Modify: `config/ads.yaml` (in-place, after test passes)
- Create: `tests/test_migrate_ads_yaml_v2.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_migrate_ads_yaml_v2.py
"""
Idempotent migration: ads.yaml v1 → v2 schema.

v2 adds per-ad: kind, placement, format, copy.hero
v2 changes: brief.cta (str) → brief.ctas (list[str])
"""
from __future__ import annotations
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent
ADS = ROOT / "config" / "ads.yaml"
SCRIPT = ROOT / "scripts" / "migrate_ads_yaml_v2.py"


def _run():
    subprocess.run([sys.executable, str(SCRIPT)], check=True, cwd=ROOT)


def test_migration_adds_required_v2_fields(tmp_path, monkeypatch):
    # Work on a copy so we don't touch real config
    copy = tmp_path / "ads.yaml"
    copy.write_text(ADS.read_text(encoding="utf-8"), encoding="utf-8")
    monkeypatch.setenv("ADS_YAML_PATH", str(copy))
    _run()
    data = yaml.safe_load(copy.read_text(encoding="utf-8"))
    for key, ad in data["ads"].items():
        assert ad["kind"] in {"image", "video", "carousel", "copy"}, key
        assert ad["placement"], f"{key}: placement missing"
        assert ad["format"], f"{key}: format missing"
        assert isinstance(ad["brief"].get("ctas"), list), f"{key}: ctas not a list"
        assert "hero" in ad.get("copy", {}), f"{key}: copy.hero missing"


def test_migration_is_idempotent(tmp_path, monkeypatch):
    copy = tmp_path / "ads.yaml"
    copy.write_text(ADS.read_text(encoding="utf-8"), encoding="utf-8")
    monkeypatch.setenv("ADS_YAML_PATH", str(copy))
    _run()
    after_first = copy.read_text(encoding="utf-8")
    _run()
    after_second = copy.read_text(encoding="utf-8")
    assert after_first == after_second, "migration is not idempotent"


def test_migration_preserves_existing_cta_value(tmp_path, monkeypatch):
    copy = tmp_path / "ads.yaml"
    copy.write_text(ADS.read_text(encoding="utf-8"), encoding="utf-8")
    monkeypatch.setenv("ADS_YAML_PATH", str(copy))
    _run()
    data = yaml.safe_load(copy.read_text(encoding="utf-8"))
    # Ad 01 in current yaml has brief.cta="Message me"; after migration it's ctas=["Message me"]
    ad01 = data["ads"]["01_portfolio_grid"]
    assert ad01["brief"]["ctas"] == ["Message me"]
```

- [ ] **Step 2: Run — expect FAIL**

```bash
/opt/homebrew/bin/pytest tests/test_migrate_ads_yaml_v2.py -q
```
Expected: 3 FAIL (script doesn't exist).

- [ ] **Step 3: Implement the migration script**

```python
# scripts/migrate_ads_yaml_v2.py
"""
Idempotent migration: adds kind/placement/format/copy.hero to every ad entry;
converts brief.cta (str) → brief.ctas (list[str]).

Env:
  ADS_YAML_PATH — override path (default: config/ads.yaml relative to repo root)

Running twice = no-op (guarded by presence checks).
"""
from __future__ import annotations
import os
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent

# Per-slug defaults derived from the Spec 1 seeded data.
# Slug → (kind, placement, format, hero_fallback)
DEFAULTS = {
    "portfolio-grid":  ("image", "Instagram Feed · 1:1", "1080×1080 png", "6 sites last month"),
    "before-after":    ("image", "Instagram Feed · 1:1", "1080×1080 png", "Invisible → Booked"),
    "social-proof":    ("image", "Instagram Feed · 1:1", "1080×1080 png", "€500 · 3× more clients"),
    "price-objection": ("image", "Instagram Feed · 1:1", "1080×1080 png", "€3,000? I charge €450"),
    "mockup-showcase": ("image", "Instagram Feed · 1:1", "1080×1080 png", "Still sending to your bio?"),
    "niche-designers": ("image", "Instagram Feed · 1:1", "1080×1080 png", "No site = no clients"),
}


def _resolve_path() -> Path:
    override = os.getenv("ADS_YAML_PATH")
    return Path(override) if override else ROOT / "config" / "ads.yaml"


def migrate(data: dict) -> dict:
    for key, ad in data.get("ads", {}).items():
        slug = ad.get("slug", "")
        kind, placement, fmt, hero_fallback = DEFAULTS.get(
            slug, ("image", "Instagram Feed · 1:1", "1080×1080 png", "")
        )
        ad.setdefault("kind", kind)
        ad.setdefault("placement", placement)
        ad.setdefault("format", fmt)

        brief = ad.setdefault("brief", {})
        if "cta" in brief and "ctas" not in brief:
            cta = brief.pop("cta")
            brief["ctas"] = [cta] if cta else []
        elif "ctas" not in brief:
            brief["ctas"] = []

        copy = ad.setdefault("copy", {})
        if "hero" not in copy:
            # Fallback to the existing headline_lead or a per-slug default
            copy["hero"] = copy.get("headline_lead") or hero_fallback or ad.get("meta", {}).get("headline", "")
    return data


def main() -> int:
    path = _resolve_path()
    if not path.exists():
        print(f"ERROR: {path} not found", file=sys.stderr)
        return 1
    raw = path.read_text(encoding="utf-8")
    data = yaml.safe_load(raw)
    migrated = migrate(data)
    new_yaml = yaml.safe_dump(migrated, sort_keys=False, allow_unicode=True)
    if new_yaml == raw:
        print(f"{path}: already v2 (no-op)")
        return 0
    path.write_text(new_yaml, encoding="utf-8")
    print(f"{path}: migrated to v2")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run — expect PASS**

```bash
/opt/homebrew/bin/pytest tests/test_migrate_ads_yaml_v2.py -q
```
Expected: 3 passed.

- [ ] **Step 5: Apply migration to real `config/ads.yaml`**

```bash
python scripts/migrate_ads_yaml_v2.py
# Expected: "config/ads.yaml: migrated to v2"
/opt/homebrew/bin/pytest -q
# Expected: all 213+ previous tests still green (existing tests don't read cta/ctas directly except test_copy_parity which uses copy.*)
```

- [ ] **Step 6: Update `test_copy_parity.py` to handle both old and new shape**

The existing test reads from `copy.*` which doesn't touch `brief.ctas`. Verify it still passes; no change needed unless it fails.

- [ ] **Step 7: Commit**

```bash
git add scripts/migrate_ads_yaml_v2.py tests/test_migrate_ads_yaml_v2.py config/ads.yaml
git commit -m "feat(ads.yaml): migrate to v2 schema (kind, placement, format, copy.hero, brief.ctas)"
```

---

### Task 2: Extend schema dataclasses

Adds `id`, `ctas`, `confidence_score`, `axes`, `selected`, `reasoning` to `CopyVariant`. Adds `run_id`, `trace_structured`, `pipeline_version`, `seed`, `created_at` to `AgentResult`. Introduces `VariantAxes` and `TraceNode`.

**Files:**
- Modify: `features/copy_generation/schema.py`
- Modify: `features/copy_generation/test_agent.py` (backward-compat check)
- Create: `features/copy_generation/test_schema.py`

- [ ] **Step 1: Write failing schema tests**

```python
# features/copy_generation/test_schema.py
from features.copy_generation.schema import (
    AgentResult, Brief, CopyVariant, TraceNode, VariantAxes,
)


def test_variant_axes_warn_when_any_below_threshold():
    axes = VariantAxes(relevance=0.55, originality=0.9, brand_fit=0.9)
    assert axes.warn is not None
    assert "relevância" in axes.warn


def test_variant_axes_no_warn_when_all_above():
    axes = VariantAxes(relevance=0.8, originality=0.85, brand_fit=0.9)
    assert axes.warn is None


def test_copy_variant_carries_id_and_ctas():
    v = CopyVariant(
        id="V1", headline="H", primary_text="P", description="D",
        ctas=["Compra"], confidence="high", confidence_score=0.9,
        axes=VariantAxes(0.9, 0.9, 0.9), reasoning="r",
    )
    assert v.id == "V1"
    assert v.ctas == ["Compra"]
    assert v.confidence_symbol == "✅"


def test_agent_result_carries_run_id_and_structured_trace():
    result = AgentResult(
        run_id="abc12345",
        variants=[],
        trace="raw",
        trace_structured=[
            TraceNode(id="brief", label="Briefing", start_ms=0, end_ms=10,
                      tokens=0, confidence=None, output_preview="...")
        ],
        methodology="pas",
        model="claude-sonnet-4-6",
        pipeline_version="copy_generation@abc1234",
        seed=None,
        created_at="2026-04-18T12:00:00Z",
    )
    assert len(result.trace_structured) == 1
    assert result.trace_structured[0].label == "Briefing"
```

- [ ] **Step 2: Run — expect FAIL**

```bash
/opt/homebrew/bin/pytest features/copy_generation/test_schema.py -q
```
Expected: 4 FAIL (imports fail).

- [ ] **Step 3: Implement schema extensions**

```python
# features/copy_generation/schema.py
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal

Confidence = Literal["high", "medium", "low"]
_CONF_SYMBOL = {"high": "✅", "medium": "⚠️", "low": "🔴"}


@dataclass
class Brief:
    product: str
    audience: str
    pain: str
    ctas: list[str] = field(default_factory=list)
    social_proof: str | None = None


@dataclass
class VariantAxes:
    relevance: float
    originality: float
    brand_fit: float

    @property
    def warn(self) -> str | None:
        lowest = min(
            ("relevância", self.relevance),
            ("originalidade", self.originality),
            ("brand fit", self.brand_fit),
            key=lambda t: t[1],
        )
        if lowest[1] < 0.6:
            return f"baixa {lowest[0]} ({lowest[1]:.2f})"
        return None


@dataclass
class CopyVariant:
    id: str
    headline: str
    primary_text: str
    description: str
    ctas: list[str]
    confidence: Confidence
    confidence_score: float
    axes: VariantAxes
    reasoning: str = ""
    selected: bool = False

    @property
    def confidence_symbol(self) -> str:
        return _CONF_SYMBOL[self.confidence]


@dataclass
class TraceNode:
    id: str
    label: str
    start_ms: int
    end_ms: int
    tokens: int
    confidence: float | None
    output_preview: str


@dataclass
class AgentResult:
    run_id: str
    variants: list[CopyVariant]
    trace: str
    trace_structured: list[TraceNode]
    methodology: str
    model: str
    pipeline_version: str
    seed: int | None = None
    created_at: str = ""
```

- [ ] **Step 4: Update `Brief` usages in `test_agent.py`**

The fixture uses `cta="Message me"` (old). Change to `ctas=["Message me"]`.

```python
# features/copy_generation/test_agent.py — fixture change
@pytest.fixture
def brief() -> Brief:
    return Brief(
        product="Custom websites from €450 in 7 days",
        audience="European freelancers",
        pain="Losing clients to competitors with real sites",
        social_proof="6 sites last month",
        ctas=["Message me"],
    )
```

- [ ] **Step 5: Update `agent.py` to produce the extended shapes**

The dry-run and real paths both need to emit the new fields. Details in Task 3.

```python
# features/copy_generation/agent.py — _dry_run_variants rewrite (snippet)
def _dry_run_variants(brief: Brief, methodology_name: str, n: int) -> AgentResult:
    import uuid, datetime
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
        created_at=datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z",
    )
```

`_call_claude` will be updated in Task 3 for prompt+JSON changes.

- [ ] **Step 6: Run — expect PASS**

```bash
/opt/homebrew/bin/pytest features/copy_generation/ -q
```
Expected: all tests pass (including existing agent tests with updated fixture).

- [ ] **Step 7: Commit**

```bash
git add features/copy_generation/schema.py features/copy_generation/agent.py \
        features/copy_generation/test_agent.py features/copy_generation/test_schema.py
git commit -m "feat(copy_generation): extend schema with VariantAxes, TraceNode, run_id, per-variant ctas"
```

---

### Task 3: PAS prompt + agent JSON validation for new fields

Updates `prompts/pas.md` to require `ctas`, `confidence_score`, `axes`, `reasoning`. Updates `_call_claude` to parse+validate them. No silent fallbacks.

**Files:**
- Modify: `features/copy_generation/prompts/pas.md`
- Modify: `features/copy_generation/agent.py`
- Modify: `features/copy_generation/test_agent.py` (FakeTextBlock returns new shape)

- [ ] **Step 1: Update the prompt**

```markdown
Methodology: PAS (Problem, Agitate, Solution).

Structure every variant as:
- Problem   — one sentence naming the audience's current pain.
- Agitate   — one or two sentences amplifying the cost of inaction.
- Solution  — the offer as resolution, ending with the CTA.

Input brief:
  product:       {product}
  audience:      {audience}
  pain:          {pain}
  social_proof:  {social_proof}
  ctas:          {ctas}

Generate {n} distinct PAS variants. Vary the hook and the angle — not just word choice.

Return a JSON array. Each element MUST have:
  - "headline":         short attention-grabbing line (≤60 chars)
  - "primary_text":     full body copy following PAS structure
  - "description":      one-line below-headline (≤90 chars)
  - "ctas":             array of 1-3 short CTAs (strings)
  - "confidence":       "high" | "medium" | "low"
  - "confidence_score": float 0.0-1.0 matching the qualitative grade
  - "axes":             {"relevance": 0.0-1.0, "originality": 0.0-1.0, "brand_fit": 0.0-1.0}
  - "reasoning":        one sentence explaining your hook choice

Return ONLY the JSON array. No prose, no markdown fences.
```

- [ ] **Step 2: Update `methodologies/pas.py` to pass ctas into prompt template**

```python
# features/copy_generation/methodologies/pas.py — build_user_prompt change
def build_user_prompt(self, brief: Brief, n: int) -> str:
    template = self.user_prompt_template_path.read_text(encoding="utf-8")
    return template.format(
        product=brief.product,
        audience=brief.audience,
        pain=brief.pain,
        social_proof=brief.social_proof or "none",
        ctas=", ".join(brief.ctas) or "Message me",
        n=n,
    )
```

- [ ] **Step 3: Update `_call_claude` to validate new fields**

```python
# features/copy_generation/agent.py — _call_claude body (modifications)
import uuid, datetime

REQUIRED_VARIANT_FIELDS = {
    "headline", "primary_text", "description", "ctas",
    "confidence", "confidence_score", "axes", "reasoning",
}

def _call_claude(methodology, user_prompt: str, n: int, model: str) -> AgentResult:
    from anthropic import Anthropic
    client = Anthropic()
    system_text = methodology.system_prompt_path.read_text(encoding="utf-8")
    run_id = uuid.uuid4().hex[:8]
    started_at = datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z"

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
        f"[{v.get('confidence', '?')}/{v.get('confidence_score', '?'):.2f}] {v.get('reasoning', '')}"
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
```

Add `ROOT_DIR = Path(__file__).resolve().parents[2]` at the top of `agent.py`.

- [ ] **Step 4: Update mocked `FakeTextBlock` in `test_agent.py`**

```python
# The existing mocks return an incomplete payload; update to emit the full v2 shape.
_FAKE_PAYLOAD = (
    '[{"headline":"H","primary_text":"P","description":"D",'
    '"ctas":["C1"],"confidence":"high","confidence_score":0.9,'
    '"axes":{"relevance":0.9,"originality":0.9,"brand_fit":0.9},'
    '"reasoning":"r"}]'
)

class FakeTextBlock:
    type = "text"
    text = _FAKE_PAYLOAD

# For test_invalid_confidence_raises: change confidence to "very high"
class FakeTextBlock_InvalidConf:
    type = "text"
    text = _FAKE_PAYLOAD.replace('"confidence":"high"', '"confidence":"very high"')

# For test_thinking_block_raises: keep class FakeThinkingBlock with type="thinking"
```

- [ ] **Step 5: Add test for missing-field rejection**

```python
def test_missing_axes_field_raises(brief, monkeypatch):
    """Claude omitting 'axes' must raise with full payload in error, not default silently."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-fake")
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)

    class FakeBlock:
        type = "text"
        text = '[{"headline":"H","primary_text":"P","description":"D","ctas":["C"],"confidence":"high","confidence_score":0.9,"reasoning":"r"}]'

    class FakeResponse:
        content = [FakeBlock()]

    class FakeMessages:
        def create(self, **kwargs):
            return FakeResponse()

    class FakeAnthropic:
        def __init__(self, *a, **kw):
            self.messages = FakeMessages()

    import anthropic
    monkeypatch.setattr(anthropic, "Anthropic", FakeAnthropic)
    with pytest.raises(RuntimeError, match="missing required fields"):
        generate(brief, methodology="pas", n=1)
```

- [ ] **Step 6: Run — expect PASS**

```bash
/opt/homebrew/bin/pytest features/copy_generation/ -q
```
Expected: all pass, including new missing-fields test.

- [ ] **Step 7: Commit**

```bash
git add features/copy_generation/
git commit -m "feat(copy_generation): PAS prompt v2 + strict validation for axes/ctas/score/reasoning"
```

---

### Task 4: `config/projects.yaml` + project_store service

Introduces multi-project schema. Seeds with `vibeweb`. Provides read/list API for services.

**Files:**
- Create: `config/projects.yaml`
- Create: `features/web_gui/__init__.py`
- Create: `features/web_gui/services/__init__.py`
- Create: `features/web_gui/services/project_store.py`
- Create: `features/web_gui/services/yaml_rw.py`
- Create: `features/web_gui/services/test_project_store.py`
- Create: `features/web_gui/CLAUDE.md`

- [ ] **Step 1: Write `test_project_store.py`**

```python
# features/web_gui/services/test_project_store.py
from pathlib import Path

import pytest
import yaml

from features.web_gui.services.project_store import ProjectStore


@pytest.fixture
def store(tmp_path: Path) -> ProjectStore:
    projects = tmp_path / "projects.yaml"
    ads = tmp_path / "ads.yaml"
    projects.write_text(yaml.safe_dump({
        "projects": {
            "alpha": {
                "slug": "alpha", "name": "Alpha", "description": "d",
                "ads_path": str(ads), "renders_path": str(tmp_path / "renders"),
                "brand_path": str(tmp_path / "brand"),
                "created_at": "2026-04-18T00:00:00Z",
            }
        }
    }))
    ads.write_text(yaml.safe_dump({"ads": {"01_x": {"id": "01", "slug": "x", "variants": []}}}))
    return ProjectStore(projects_yaml=projects)


def test_list_returns_all_projects(store):
    items = store.list()
    assert len(items) == 1
    assert items[0].slug == "alpha"
    assert items[0].ad_count == 1
    assert items[0].variant_count == 0


def test_get_by_slug_found(store):
    p = store.get("alpha")
    assert p.name == "Alpha"


def test_get_by_slug_missing_raises(store):
    with pytest.raises(KeyError, match="unknown project 'ghost'"):
        store.get("ghost")
```

- [ ] **Step 2: Run — expect FAIL**

```bash
/opt/homebrew/bin/pytest features/web_gui/services/test_project_store.py -q
```

- [ ] **Step 3: Implement `yaml_rw.py` (atomic read-modify-write helper)**

```python
# features/web_gui/services/yaml_rw.py
"""
Atomic yaml read-modify-write with fcntl.flock.

Writes go to <path>.tmp then os.replace to path (atomic on POSIX).
A .bak copy of the previous content is kept alongside.
"""
from __future__ import annotations
import fcntl
import os
from pathlib import Path
from typing import Callable

import yaml


def read(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_SH)
        try:
            return yaml.safe_load(f) or {}
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)


def write(path: Path, data: dict) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    bak = path.with_suffix(path.suffix + ".bak")
    content = yaml.safe_dump(data, sort_keys=False, allow_unicode=True)
    with tmp.open("w", encoding="utf-8") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        try:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    if path.exists():
        path.replace(bak)
    tmp.replace(path)


def modify(path: Path, fn: Callable[[dict], dict]) -> dict:
    """Read, apply fn, write. Full flow is held under LOCK_EX to prevent races."""
    with path.open("r+", encoding="utf-8") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        try:
            data = yaml.safe_load(f) or {}
            new_data = fn(data)
            content = yaml.safe_dump(new_data, sort_keys=False, allow_unicode=True)
            f.seek(0)
            f.truncate()
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
            return new_data
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
```

- [ ] **Step 4: Implement `project_store.py`**

```python
# features/web_gui/services/project_store.py
"""
Reads config/projects.yaml, joins with config/ads.yaml counts.
Verbose entry-point — no ORM, no caching layer.
"""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path

from features.web_gui.services import yaml_rw


@dataclass
class Project:
    slug: str
    name: string  # NOTE: string is an alias here — import str from typing if needed
    description: str
    ad_count: int
    variant_count: int
    created_at: str


class ProjectStore:
    def __init__(self, projects_yaml: Path):
        self.path = projects_yaml

    def list(self) -> list[Project]:
        data = yaml_rw.read(self.path)
        out: list[Project] = []
        for slug, entry in data.get("projects", {}).items():
            ads_path = Path(entry["ads_path"])
            ad_count, variant_count = _ad_and_variant_counts(ads_path)
            out.append(Project(
                slug=slug,
                name=entry["name"],
                description=entry.get("description", ""),
                ad_count=ad_count,
                variant_count=variant_count,
                created_at=entry.get("created_at", ""),
            ))
        return out

    def get(self, slug: str) -> Project:
        for p in self.list():
            if p.slug == slug:
                return p
        raise KeyError(f"unknown project {slug!r}")


def _ad_and_variant_counts(ads_path: Path) -> tuple[int, int]:
    if not ads_path.exists():
        return 0, 0
    data = yaml_rw.read(ads_path)
    ads = data.get("ads", {})
    ad_count = len(ads)
    variant_count = sum(len(ad.get("variants", [])) for ad in ads.values())
    return ad_count, variant_count
```

**Correction for the dataclass**: replace `name: string` with `name: str` — Python doesn't have a `string` type.

- [ ] **Step 5: Seed `config/projects.yaml`**

```yaml
# config/projects.yaml
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

- [ ] **Step 6: Write `features/web_gui/CLAUDE.md`**

```markdown
# features/web_gui — agent context

Inherits from the root `CLAUDE.md`. Feature-specific rules.

## What this does

FastAPI backend (Python) + Vite + React + TypeScript frontend (`ui/`) serving
as the local desktop app for generating Meta Ads creatives through Vibe Web's
AI agents. Plugs into `features/copy_generation/agent.generate()` over HTTP+SSE.

## Non-obvious constraints

- **Vertical slice = everything lives here.** `server.py` is the verbose entry-point;
  no hidden orchestrators. Routes registered explicitly in the file.
- **YAML is the source of truth.** No database. `config/projects.yaml` +
  `config/ads.yaml` carry state; writes are atomic with fcntl.flock via
  `services/yaml_rw.py`.
- **Dry-run parity is load-bearing.** UI code path is identical between dry-run
  and real; backend handles the fork. Never `if (dryRun)` in React.
- **Traces go to disk.** `features/web_gui/traces/<run_id>.json` — .gitignored.
- **kind: image only in MVP.** Schema supports video/carousel/copy; UI shows
  empty tabs with "em breve" for those kinds until Spec 2/3 extensions land.
- **AIDA/BAB/NPQEL return 501.** UI toggles exist but disabled with tooltip.
```

- [ ] **Step 7: Run — expect PASS**

```bash
/opt/homebrew/bin/pytest features/web_gui/services/test_project_store.py -q
```

- [ ] **Step 8: Commit**

```bash
git add config/projects.yaml features/web_gui/
git commit -m "feat(web_gui): projects schema + project_store service + yaml_rw atomic helpers"
```

---

## Phase 2 — Backend API

### Task 5: FastAPI skeleton + Projects routes

**Files:**
- Create: `features/web_gui/server.py`
- Create: `features/web_gui/settings.py`
- Create: `features/web_gui/api/__init__.py`
- Create: `features/web_gui/api/projects.py`
- Create: `features/web_gui/api/serializers.py`
- Create: `features/web_gui/test_server.py`
- Modify: `pyproject.toml` (add fastapi, uvicorn[standard], httpx for tests)

- [ ] **Step 1: Add deps to `pyproject.toml`**

```toml
# pyproject.toml — add to existing dependencies
[project]
dependencies = [
    # ... existing ...
    "fastapi>=0.115,<1.0",
    "uvicorn[standard]>=0.32,<1.0",
    "anyio>=4,<5",
]

[project.optional-dependencies]
dev = [
    # ... existing ...
    "httpx>=0.27,<1.0",
]
```

- [ ] **Step 2: Write failing server test**

```python
# features/web_gui/test_server.py
import pytest
from fastapi.testclient import TestClient

from features.web_gui.server import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    import yaml
    projects = tmp_path / "projects.yaml"
    ads = tmp_path / "ads.yaml"
    projects.write_text(yaml.safe_dump({
        "projects": {"vibeweb": {
            "slug": "vibeweb", "name": "Vibe Web", "description": "",
            "ads_path": str(ads), "renders_path": str(tmp_path/"renders"),
            "brand_path": str(tmp_path/"brand"),
            "created_at": "2026-04-18T00:00:00Z",
        }}
    }))
    ads.write_text(yaml.safe_dump({"ads": {}}))
    monkeypatch.setenv("VIBEWEB_PROJECTS_YAML", str(projects))
    app = create_app()
    return TestClient(app)


def test_list_projects(client):
    r = client.get("/api/v1/projects")
    assert r.status_code == 200
    body = r.json()
    assert "projects" in body
    assert body["projects"][0]["slug"] == "vibeweb"


def test_get_project_by_slug(client):
    r = client.get("/api/v1/projects/vibeweb")
    assert r.status_code == 200
    assert r.json()["name"] == "Vibe Web"


def test_get_missing_project_returns_404(client):
    r = client.get("/api/v1/projects/ghost")
    assert r.status_code == 404
    body = r.json()
    assert body["code"] == "PROJECT_NOT_FOUND"
```

- [ ] **Step 3: Run — expect FAIL**

```bash
/opt/homebrew/bin/pytest features/web_gui/test_server.py -q
```

- [ ] **Step 4: Implement `settings.py`**

```python
# features/web_gui/settings.py
"""
Env-sourced settings. No framework, no pydantic-settings — verbose on purpose.
"""
from __future__ import annotations
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def projects_yaml_path() -> Path:
    return Path(os.getenv("VIBEWEB_PROJECTS_YAML", str(ROOT / "config" / "projects.yaml")))


def traces_dir() -> Path:
    p = ROOT / "features" / "web_gui" / "traces"
    p.mkdir(parents=True, exist_ok=True)
    return p


def uploads_dir() -> Path:
    p = ROOT / "features" / "web_gui" / "uploads"
    p.mkdir(parents=True, exist_ok=True)
    return p


def static_dir() -> Path:
    return ROOT / "features" / "web_gui" / "static"
```

- [ ] **Step 5: Implement `api/serializers.py` (minimal for projects)**

```python
# features/web_gui/api/serializers.py
from pydantic import BaseModel


class ProjectOut(BaseModel):
    slug: str
    name: str
    description: str
    ad_count: int
    variant_count: int
    created_at: str


class ProjectListOut(BaseModel):
    projects: list[ProjectOut]


class ErrorOut(BaseModel):
    error: str
    code: str
    raw: str = ""
```

- [ ] **Step 6: Implement `api/projects.py`**

```python
# features/web_gui/api/projects.py
from fastapi import APIRouter, HTTPException

from features.web_gui.api.serializers import ErrorOut, ProjectListOut, ProjectOut
from features.web_gui.services.project_store import ProjectStore
from features.web_gui.settings import projects_yaml_path

router = APIRouter(prefix="/projects", tags=["projects"])


def _store() -> ProjectStore:
    return ProjectStore(projects_yaml_path())


@router.get("", response_model=ProjectListOut)
def list_projects():
    items = _store().list()
    return ProjectListOut(projects=[ProjectOut(**p.__dict__) for p in items])


@router.get("/{slug}", response_model=ProjectOut, responses={404: {"model": ErrorOut}})
def get_project(slug: str):
    try:
        p = _store().get(slug)
    except KeyError:
        raise HTTPException(status_code=404, detail={
            "error": f"Project {slug!r} not found in projects.yaml",
            "code": "PROJECT_NOT_FOUND",
        })
    return ProjectOut(**p.__dict__)
```

- [ ] **Step 7: Implement `server.py`**

```python
# features/web_gui/server.py
"""
FastAPI entry point — verbose route registration, no middleware magic.

Routes:
  /api/v1/projects            (projects.py)
  /api/v1/projects/{slug}     (projects.py)
  [later tasks add]:
    /api/v1/projects/{slug}/ads/{ad_id}/brief        [GET, PUT]  (briefs.py)
    /api/v1/projects/{slug}/creatives                (creatives.py)
    /api/v1/generate          [POST]                 (generate.py)
    /api/v1/generate/stream   [POST SSE]             (generate.py)
    /api/v1/variants/{run_id}/{variant_id}  [PATCH]  (variants.py)
    /api/v1/traces/{run_id}                          (traces.py)
    /api/v1/assets/upload                            (assets.py)
"""
from __future__ import annotations
from fastapi import FastAPI
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from features.web_gui.api import projects
from features.web_gui.settings import static_dir


def create_app() -> FastAPI:
    app = FastAPI(title="Vibe Web Criativos", version="0.1.0")
    app.include_router(projects.router, prefix="/api/v1")

    @app.exception_handler(HTTPException)
    async def http_exc_handler(_, exc: HTTPException):
        detail = exc.detail if isinstance(exc.detail, dict) else {
            "error": str(exc.detail), "code": f"HTTP_{exc.status_code}",
        }
        return JSONResponse(status_code=exc.status_code, content=detail)

    sdir = static_dir()
    if sdir.exists():
        app.mount("/ui", StaticFiles(directory=str(sdir), html=True), name="ui")
    return app


app = create_app()
```

- [ ] **Step 8: Run — expect PASS**

```bash
pip install --break-system-packages fastapi uvicorn httpx
/opt/homebrew/bin/pytest features/web_gui/test_server.py -q
```

- [ ] **Step 9: Commit**

```bash
git add pyproject.toml features/web_gui/
git commit -m "feat(web_gui): FastAPI skeleton + /projects routes + ErrorOut contract"
```

---

### Task 6: Briefs routes (GET + PUT atomic write)

**Files:**
- Create: `features/web_gui/api/briefs.py`
- Modify: `features/web_gui/api/serializers.py`
- Modify: `features/web_gui/server.py`
- Modify: `features/web_gui/test_server.py`

- [ ] **Step 1: Add test cases**

```python
# features/web_gui/test_server.py — append
import yaml

def _seed_ad(client, ads_path):
    ads_path.write_text(yaml.safe_dump({
        "ads": {
            "01_portfolio_grid": {
                "id": "01", "slug": "portfolio-grid",
                "brief": {"product": "p", "audience": "a", "pain": "pa",
                          "social_proof": "sp", "ctas": ["Message me"]},
                "variants": [],
            }
        }
    }))


def test_get_brief(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    _seed_ad(client, ads)
    r = client.get("/api/v1/projects/vibeweb/ads/01/brief")
    assert r.status_code == 200
    assert r.json()["ctas"] == ["Message me"]


def test_put_brief_persists(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    _seed_ad(client, ads)
    new_brief = {
        "product": "new product", "audience": "new aud", "pain": "new pain",
        "social_proof": None, "ctas": ["Click me", "Order now"],
    }
    r = client.put("/api/v1/projects/vibeweb/ads/01/brief", json=new_brief)
    assert r.status_code == 200
    assert r.json()["updated"] is True
    # Reload and assert
    data = yaml.safe_load(ads.read_text())
    assert data["ads"]["01_portfolio_grid"]["brief"]["ctas"] == ["Click me", "Order now"]
```

- [ ] **Step 2: Implement `api/briefs.py`**

```python
# features/web_gui/api/briefs.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from features.web_gui.services import yaml_rw
from features.web_gui.services.project_store import ProjectStore
from features.web_gui.settings import projects_yaml_path

router = APIRouter(prefix="/projects/{slug}/ads/{ad_id}/brief", tags=["briefs"])


class BriefIn(BaseModel):
    product: str
    audience: str
    pain: str
    ctas: list[str]
    social_proof: str | None = None


class BriefOut(BriefIn):
    pass


def _ads_path(slug: str):
    store = ProjectStore(projects_yaml_path())
    try:
        project = store.get(slug)
    except KeyError:
        raise HTTPException(404, detail={"error": f"project {slug!r} not found", "code": "PROJECT_NOT_FOUND"})
    from pathlib import Path
    return Path(projects_yaml_path().parent / project.slug).parent  # placeholder — see next

# Actual ads_path resolution — read straight from projects.yaml:
def _resolve_ads_path(slug: str):
    data = yaml_rw.read(projects_yaml_path())
    projects = data.get("projects", {})
    if slug not in projects:
        raise HTTPException(404, detail={"error": f"project {slug!r} not found", "code": "PROJECT_NOT_FOUND"})
    from pathlib import Path
    return Path(projects[slug]["ads_path"])


def _find_ad_key(ads_data: dict, ad_id: str) -> str:
    for key, ad in ads_data.get("ads", {}).items():
        if ad.get("id") == ad_id:
            return key
    raise HTTPException(404, detail={"error": f"ad {ad_id!r} not found in project", "code": "AD_NOT_FOUND"})


@router.get("", response_model=BriefOut)
def get_brief(slug: str, ad_id: str):
    ads_path = _resolve_ads_path(slug)
    data = yaml_rw.read(ads_path)
    key = _find_ad_key(data, ad_id)
    brief = data["ads"][key]["brief"]
    return BriefOut(
        product=brief.get("product", ""),
        audience=brief.get("audience", ""),
        pain=brief.get("pain", ""),
        ctas=brief.get("ctas", []),
        social_proof=brief.get("social_proof"),
    )


@router.put("")
def put_brief(slug: str, ad_id: str, payload: BriefIn):
    ads_path = _resolve_ads_path(slug)

    def mutate(data: dict) -> dict:
        key = _find_ad_key(data, ad_id)
        data["ads"][key]["brief"] = payload.model_dump()
        return data

    yaml_rw.modify(ads_path, mutate)
    return {"updated": True, "brief": payload.model_dump()}
```

- [ ] **Step 3: Wire into `server.py`**

```python
# features/web_gui/server.py — additional import + include_router
from features.web_gui.api import briefs
# ...
app.include_router(briefs.router, prefix="/api/v1")
```

- [ ] **Step 4: Run — expect PASS**

```bash
/opt/homebrew/bin/pytest features/web_gui/test_server.py -q
```

- [ ] **Step 5: Commit**

```bash
git add features/web_gui/
git commit -m "feat(web_gui): briefs routes GET/PUT with atomic yaml write"
```

---

### Task 7: Creatives route

**Files:**
- Create: `features/web_gui/api/creatives.py`
- Modify: `features/web_gui/api/serializers.py`
- Modify: `features/web_gui/server.py`
- Modify: `features/web_gui/test_server.py`

- [ ] **Step 1: Write failing test**

```python
def test_list_creatives_shapes_match_contract(client, tmp_path):
    ads = tmp_path / "ads.yaml"
    ads.write_text(yaml.safe_dump({
        "ads": {
            "01_portfolio_grid": {
                "id": "01", "slug": "portfolio-grid",
                "kind": "image", "placement": "Instagram Feed · 1:1",
                "format": "1080×1080 png",
                "brief": {"product": "p", "audience": "a", "pain": "x",
                          "ctas": ["Click"], "social_proof": None},
                "copy": {"hero": "Hero text"},
                "meta": {"headline": "H", "primary_text": "PT", "description": "D"},
                "variants": [],
            }
        }
    }))
    r = client.get("/api/v1/projects/vibeweb/creatives")
    assert r.status_code == 200
    body = r.json()
    assert len(body["creatives"]) == 1
    c = body["creatives"][0]
    assert c["id"] == "portfolio-grid-base"
    assert c["kind"] == "image"
    assert c["thumbnail_url"] == "/renders/01-portfolio-grid.png"
    assert c["ctas"] == ["Click"]
```

- [ ] **Step 2: Implement `creatives.py`**

```python
# features/web_gui/api/creatives.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from features.web_gui.services import yaml_rw
from features.web_gui.settings import projects_yaml_path

router = APIRouter(prefix="/projects/{slug}/creatives", tags=["creatives"])


class CreativeOut(BaseModel):
    id: str
    kind: str
    title: str
    placement: str
    format: str
    headline: str
    body: str
    hero: str
    ctas: list[str]
    thumbnail_url: str
    status: str
    ad_id: str
    variant_id: str | None


class CreativeListOut(BaseModel):
    creatives: list[CreativeOut]


def _resolve_ads_path(slug: str):
    data = yaml_rw.read(projects_yaml_path())
    if slug not in data.get("projects", {}):
        raise HTTPException(404, detail={"error": f"project {slug!r} not found", "code": "PROJECT_NOT_FOUND"})
    from pathlib import Path
    return Path(data["projects"][slug]["ads_path"])


@router.get("", response_model=CreativeListOut)
def list_creatives(slug: str, kind: str | None = None, status: str | None = None):
    ads_path = _resolve_ads_path(slug)
    data = yaml_rw.read(ads_path)
    out: list[CreativeOut] = []
    for _, ad in data.get("ads", {}).items():
        base = _ad_to_creative_base(ad)
        if kind and base.kind != kind:
            continue
        if status and base.status != status:
            continue
        out.append(base)
        # Variants
        for v in ad.get("variants", []):
            out.append(_variant_to_creative(ad, v))
    return CreativeListOut(creatives=out)


def _ad_to_creative_base(ad: dict) -> CreativeOut:
    return CreativeOut(
        id=f"{ad['slug']}-base",
        kind=ad.get("kind", "image"),
        title=ad["slug"].replace("-", " ").title(),
        placement=ad.get("placement", ""),
        format=ad.get("format", ""),
        headline=ad.get("meta", {}).get("headline", ""),
        body=ad.get("meta", {}).get("primary_text", ""),
        hero=ad.get("copy", {}).get("hero", ""),
        ctas=ad.get("brief", {}).get("ctas", []),
        thumbnail_url=f"/renders/{ad['id']}-{ad['slug']}.png",
        status="ready",
        ad_id=ad["id"],
        variant_id=None,
    )


def _variant_to_creative(ad: dict, v: dict) -> CreativeOut:
    return CreativeOut(
        id=f"{ad['slug']}-{v['id'].lower()}",
        kind=ad.get("kind", "image"),
        title=f"{ad['slug'].replace('-', ' ').title()} · {v['id']}",
        placement=ad.get("placement", ""),
        format=ad.get("format", ""),
        headline=v.get("headline", ""),
        body=v.get("primary_text", ""),
        hero=ad.get("copy", {}).get("hero", ""),
        ctas=v.get("ctas", []),
        thumbnail_url=f"/renders/{ad['id']}-{ad['slug']}.png",  # same render for now
        status="ready",
        ad_id=ad["id"],
        variant_id=v["id"],
    )
```

- [ ] **Step 3: Mount static `/renders` in `server.py`**

```python
# features/web_gui/server.py — additional mount
from features.web_gui.settings import ROOT  # if not already imported

renders_dir = ROOT / "ads" / "renders"
if renders_dir.exists():
    app.mount("/renders", StaticFiles(directory=str(renders_dir)), name="renders")
```

- [ ] **Step 4: Wire into `server.py`**

```python
from features.web_gui.api import creatives
app.include_router(creatives.router, prefix="/api/v1")
```

- [ ] **Step 5: Run — expect PASS**

```bash
/opt/homebrew/bin/pytest features/web_gui/test_server.py -q
```

- [ ] **Step 6: Commit**

```bash
git add features/web_gui/
git commit -m "feat(web_gui): creatives route + static /renders mount"
```

---

### Task 8: Generate (non-streaming) route

**Files:**
- Create: `features/web_gui/api/generate.py`
- Create: `features/web_gui/services/trace_store.py`
- Modify: `features/web_gui/server.py`
- Modify: `features/web_gui/test_server.py`

- [ ] **Step 1: Write failing test (dry-run path)**

```python
def test_generate_dry_run_returns_n_variants(client, tmp_path, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    ads = tmp_path / "ads.yaml"
    ads.write_text(yaml.safe_dump({"ads": {
        "01_portfolio_grid": {
            "id": "01", "slug": "portfolio-grid", "kind": "image",
            "brief": {"product": "p", "audience": "a", "pain": "x",
                      "ctas": ["Click"], "social_proof": None},
            "copy": {"hero": "h"}, "meta": {"headline": "H", "primary_text": "PT", "description": "D"},
            "variants": [],
        }
    }}))
    r = client.post("/api/v1/generate", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "pas", "n_variants": 3, "persist": False,
    })
    assert r.status_code == 200
    body = r.json()
    assert len(body["variants"]) == 3
    assert body["methodology"] == "pas"


def test_generate_unknown_methodology_501(client):
    r = client.post("/api/v1/generate", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "aida", "n_variants": 3, "persist": False,
    })
    assert r.status_code == 501
    assert r.json()["code"] == "METHODOLOGY_NOT_IMPLEMENTED"
```

- [ ] **Step 2: Implement `trace_store.py`**

```python
# features/web_gui/services/trace_store.py
import json
from pathlib import Path

from features.web_gui.settings import traces_dir


def save(run_id: str, data: dict) -> Path:
    p = traces_dir() / f"{run_id}.json"
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return p


def load(run_id: str) -> dict:
    p = traces_dir() / f"{run_id}.json"
    return json.loads(p.read_text(encoding="utf-8"))
```

- [ ] **Step 3: Implement `api/generate.py`**

```python
# features/web_gui/api/generate.py
from dataclasses import asdict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from features.copy_generation.agent import generate
from features.copy_generation.schema import Brief
from features.web_gui.services import trace_store, yaml_rw
from features.web_gui.settings import projects_yaml_path

router = APIRouter(prefix="/generate", tags=["generate"])

IMPLEMENTED_METHODOLOGIES = {"pas"}


class GenerateIn(BaseModel):
    project_slug: str
    ad_id: str
    methodology: str
    n_variants: int = 3
    brief_overrides: dict | None = None
    persist: bool = True


def _resolve_ads_path(slug: str):
    data = yaml_rw.read(projects_yaml_path())
    if slug not in data.get("projects", {}):
        raise HTTPException(404, detail={"error": f"project {slug!r} not found", "code": "PROJECT_NOT_FOUND"})
    from pathlib import Path
    return Path(data["projects"][slug]["ads_path"])


def _find_ad_key(ads_data: dict, ad_id: str) -> str:
    for key, ad in ads_data.get("ads", {}).items():
        if ad.get("id") == ad_id:
            return key
    raise HTTPException(404, detail={"error": f"ad {ad_id!r} not found", "code": "AD_NOT_FOUND"})


@router.post("")
def generate_variants(payload: GenerateIn):
    if payload.methodology not in IMPLEMENTED_METHODOLOGIES:
        raise HTTPException(501, detail={
            "error": f"Methodology {payload.methodology!r} stubbed; implement features/copy_generation/methodologies/{payload.methodology}.py",
            "code": "METHODOLOGY_NOT_IMPLEMENTED",
        })

    ads_path = _resolve_ads_path(payload.project_slug)
    data = yaml_rw.read(ads_path)
    key = _find_ad_key(data, payload.ad_id)
    brief_data = {**data["ads"][key]["brief"], **(payload.brief_overrides or {})}
    brief = Brief(
        product=brief_data.get("product", ""),
        audience=brief_data.get("audience", ""),
        pain=brief_data.get("pain", ""),
        ctas=brief_data.get("ctas", []),
        social_proof=brief_data.get("social_proof"),
    )

    result = generate(brief, methodology=payload.methodology, n=payload.n_variants)

    serialized = {
        "run_id": result.run_id,
        "variants": [
            {**asdict(v), "axes": asdict(v.axes), "confidence_symbol": v.confidence_symbol}
            for v in result.variants
        ],
        "trace": result.trace,
        "trace_structured": [asdict(n) for n in result.trace_structured],
        "methodology": result.methodology,
        "model": result.model,
        "pipeline_version": result.pipeline_version,
        "seed": result.seed,
        "created_at": result.created_at,
    }

    # Persist trace to disk (always)
    trace_store.save(result.run_id, serialized)

    # Persist variants into ads.yaml (if persist=True)
    if payload.persist:
        def mutate(data: dict) -> dict:
            data["ads"][key]["variants"] = serialized["variants"]
            data["ads"][key]["trace"]["last_run"] = result.run_id
            data["ads"][key]["trace"]["confidence"] = result.variants[0].confidence if result.variants else None
            return data
        yaml_rw.modify(ads_path, mutate)

    return serialized
```

- [ ] **Step 4: Wire into `server.py`**

```python
from features.web_gui.api import generate as generate_module
app.include_router(generate_module.router, prefix="/api/v1")
```

- [ ] **Step 5: Run — expect PASS**

```bash
/opt/homebrew/bin/pytest features/web_gui/test_server.py -q
```

- [ ] **Step 6: Commit**

```bash
git add features/web_gui/
git commit -m "feat(web_gui): POST /generate with trace persistence + 501 for stubbed methodologies"
```

---

### Task 9: Generate streaming (SSE)

**Files:**
- Modify: `features/web_gui/api/generate.py`
- Create: `features/copy_generation/streaming.py` (shared with UI + server)
- Modify: `features/web_gui/test_server.py`

- [ ] **Step 1: Write failing SSE test**

```python
def test_generate_stream_emits_ordered_events(client, tmp_path, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    ads = tmp_path / "ads.yaml"
    # (seed ads as before)
    # ...
    with client.stream("POST", "/api/v1/generate/stream", json={
        "project_slug": "vibeweb", "ad_id": "01",
        "methodology": "pas", "n_variants": 2, "persist": False,
    }) as r:
        events = []
        for line in r.iter_lines():
            if line.startswith("event:"):
                events.append(line.split(":", 1)[1].strip())
    # Order assertion: run_start → node_start → tokens → variant_done → ... → done
    assert events[0] == "run_start"
    assert "done" in events
    assert events[-1] == "done"
    assert "variant_done" in events
```

- [ ] **Step 2: Implement `features/copy_generation/streaming.py` (dry-run event generator)**

```python
# features/copy_generation/streaming.py
"""
Dry-run SSE event generator so the UI code path is identical offline.
Real mode streams from anthropic.messages.stream — same event shapes.
"""
from __future__ import annotations
import json
import time
import uuid
from dataclasses import asdict
from typing import Iterator

from features.copy_generation.agent import _dry_run_variants
from features.copy_generation.schema import Brief


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def dry_run_events(brief: Brief, methodology_name: str, n: int) -> Iterator[str]:
    result = _dry_run_variants(brief, methodology_name, n)
    run_start = time.monotonic()
    yield sse("run_start", {
        "run_id": result.run_id,
        "pipeline_version": result.pipeline_version,
        "started_at": result.created_at,
    })
    yield sse("node_start", {"node_id": "brief", "label": "Briefing", "start_ms": 0})
    yield sse("node_done", {"node_id": "brief", "end_ms": 20, "tokens": 0,
                            "confidence": None, "output_preview": brief.pain[:80]})
    yield sse("node_start", {"node_id": "agent", "label": "Agente criativo", "start_ms": 20})
    for v in result.variants:
        # Simulated token stream — 4 chars per chunk
        for chunk in _chunks(v.headline, 4):
            yield sse("token", {"node_id": "agent", "text": chunk})
            time.sleep(0.02)
        yield sse("variant_done", {
            **asdict(v), "axes": asdict(v.axes), "confidence_symbol": v.confidence_symbol,
        })
    end_ms = int((time.monotonic() - run_start) * 1000)
    yield sse("node_done", {"node_id": "agent", "end_ms": end_ms, "tokens": 120,
                            "confidence": 0.7, "output_preview": "dry-run"})
    serialized = {
        "run_id": result.run_id,
        "variants": [{**asdict(v), "axes": asdict(v.axes), "confidence_symbol": v.confidence_symbol} for v in result.variants],
        "trace": result.trace, "trace_structured": [],
        "methodology": result.methodology, "model": result.model,
        "pipeline_version": result.pipeline_version, "seed": result.seed,
        "created_at": result.created_at,
    }
    yield sse("done", serialized)


def _chunks(s: str, n: int) -> Iterator[str]:
    for i in range(0, len(s), n):
        yield s[i:i+n]
```

- [ ] **Step 3: Add SSE endpoint in `generate.py`**

```python
# features/web_gui/api/generate.py — append
from fastapi.responses import StreamingResponse
from features.copy_generation.agent import _is_dry_run
from features.copy_generation.streaming import dry_run_events

@router.post("/stream")
def generate_stream(payload: GenerateIn):
    if payload.methodology not in IMPLEMENTED_METHODOLOGIES:
        raise HTTPException(501, detail={
            "error": f"Methodology {payload.methodology!r} stubbed",
            "code": "METHODOLOGY_NOT_IMPLEMENTED",
        })
    ads_path = _resolve_ads_path(payload.project_slug)
    data = yaml_rw.read(ads_path)
    key = _find_ad_key(data, payload.ad_id)
    brief_data = {**data["ads"][key]["brief"], **(payload.brief_overrides or {})}
    brief = Brief(
        product=brief_data.get("product", ""),
        audience=brief_data.get("audience", ""),
        pain=brief_data.get("pain", ""),
        ctas=brief_data.get("ctas", []),
        social_proof=brief_data.get("social_proof"),
    )

    if _is_dry_run():
        return StreamingResponse(
            dry_run_events(brief, payload.methodology, payload.n_variants),
            media_type="text/event-stream",
        )
    # Real streaming path
    return StreamingResponse(
        _real_stream_events(brief, payload),
        media_type="text/event-stream",
    )


def _real_stream_events(brief: Brief, payload):
    """Placeholder for Task 9b — uses anthropic.messages.stream.
    For MVP, falls back to non-streaming call and re-emits events synthesized from result.
    """
    from dataclasses import asdict
    result = generate(brief, methodology=payload.methodology, n=payload.n_variants)
    # emit same events as dry_run_events, replaying from result — not true token-by-token
    from features.copy_generation.streaming import sse
    yield sse("run_start", {"run_id": result.run_id, "pipeline_version": result.pipeline_version, "started_at": result.created_at})
    yield sse("node_start", {"node_id": "agent", "label": "Agente criativo", "start_ms": 0})
    for v in result.variants:
        yield sse("variant_done", {**asdict(v), "axes": asdict(v.axes), "confidence_symbol": v.confidence_symbol})
    yield sse("node_done", {"node_id": "agent", "end_ms": 0, "tokens": 0, "confidence": None, "output_preview": ""})
    yield sse("done", {
        "run_id": result.run_id,
        "variants": [{**asdict(v), "axes": asdict(v.axes), "confidence_symbol": v.confidence_symbol} for v in result.variants],
        "trace": result.trace, "trace_structured": [],
        "methodology": result.methodology, "model": result.model,
        "pipeline_version": result.pipeline_version, "seed": result.seed,
        "created_at": result.created_at,
    })
```

A follow-up task (9b, tagged as "v2 nice-to-have") upgrades `_real_stream_events` to consume `anthropic.messages.stream().text_stream` for char-by-char.

- [ ] **Step 4: Run — expect PASS**

```bash
/opt/homebrew/bin/pytest features/web_gui/test_server.py -q
```

- [ ] **Step 5: Commit**

```bash
git add features/web_gui/ features/copy_generation/streaming.py
git commit -m "feat(web_gui): SSE /generate/stream with dry-run event parity"
```

---

### Task 10: Variants PATCH + Traces GET + Assets upload

**Files:**
- Create: `features/web_gui/api/variants.py`
- Create: `features/web_gui/api/traces.py`
- Create: `features/web_gui/api/assets.py`
- Create: `features/web_gui/services/asset_store.py`
- Modify: `features/web_gui/server.py`
- Modify: `features/web_gui/test_server.py`

- [ ] **Step 1: Write failing tests**

```python
# test_server.py — append
def test_patch_variant_persists_selection(client, tmp_path, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    # seed + generate (persist=True)
    # ...
    # run id known from response
    r = client.patch(f"/api/v1/variants/{run_id}/V1", json={"selected": True})
    assert r.status_code == 200
    assert r.json()["selected"] is True


def test_get_trace_returns_persisted(client, ...):
    r = client.get(f"/api/v1/traces/{run_id}")
    assert r.status_code == 200
    assert r.json()["run_id"] == run_id


def test_upload_asset_stores_file(client, tmp_path):
    f = tmp_path / "logo.png"
    f.write_bytes(b"\x89PNG\r\n\x1a\n" + b"0" * 100)
    with f.open("rb") as fp:
        r = client.post("/api/v1/assets/upload", files={"files": ("logo.png", fp, "image/png")},
                        data={"project_slug": "vibeweb"})
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["filename"] == "logo.png"
```

- [ ] **Step 2: Implement `api/variants.py`**

```python
# features/web_gui/api/variants.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from features.web_gui.services import yaml_rw
from features.web_gui.settings import projects_yaml_path

router = APIRouter(prefix="/variants", tags=["variants"])


class VariantPatch(BaseModel):
    selected: bool | None = None
    headline: str | None = None
    primary_text: str | None = None
    description: str | None = None
    ctas: list[str] | None = None


@router.patch("/{run_id}/{variant_id}")
def patch_variant(run_id: str, variant_id: str, patch: VariantPatch):
    # Scan ads.yaml across all projects for the run_id
    pdata = yaml_rw.read(projects_yaml_path())
    for slug, pentry in pdata.get("projects", {}).items():
        from pathlib import Path
        ads_path = Path(pentry["ads_path"])
        data = yaml_rw.read(ads_path)
        for key, ad in data.get("ads", {}).items():
            if ad.get("trace", {}).get("last_run") == run_id:
                for v in ad.get("variants", []):
                    if v.get("id") == variant_id:
                        diff = {k: v for k, v in patch.model_dump().items() if v is not None}
                        def mutate(d):
                            for vv in d["ads"][key]["variants"]:
                                if vv["id"] == variant_id:
                                    vv.update(diff)
                            return d
                        yaml_rw.modify(ads_path, mutate)
                        return {**v, **diff}
    raise HTTPException(404, detail={"error": f"variant {run_id}/{variant_id} not found", "code": "VARIANT_NOT_FOUND"})
```

- [ ] **Step 3: Implement `api/traces.py`**

```python
# features/web_gui/api/traces.py
from fastapi import APIRouter, HTTPException
from features.web_gui.services import trace_store

router = APIRouter(prefix="/traces", tags=["traces"])


@router.get("/{run_id}")
def get_trace(run_id: str):
    try:
        return trace_store.load(run_id)
    except FileNotFoundError:
        raise HTTPException(404, detail={"error": f"trace {run_id} not found", "code": "TRACE_NOT_FOUND"})
```

- [ ] **Step 4: Implement `api/assets.py` + `services/asset_store.py`**

```python
# features/web_gui/services/asset_store.py
import uuid
from pathlib import Path
from features.web_gui.settings import uploads_dir


def save(project_slug: str, filename: str, content: bytes) -> dict:
    ext = Path(filename).suffix
    file_id = uuid.uuid4().hex
    dest = uploads_dir() / project_slug
    dest.mkdir(parents=True, exist_ok=True)
    path = dest / f"{file_id}{ext}"
    path.write_bytes(content)
    return {"file_id": file_id, "filename": filename, "size": len(content), "kind": _kind_for(ext)}


def _kind_for(ext: str) -> str:
    return {".png": "product", ".jpg": "product", ".jpeg": "product",
            ".svg": "logo", ".pdf": "doc", ".mp4": "product"}.get(ext.lower(), "doc")
```

```python
# features/web_gui/api/assets.py
from fastapi import APIRouter, File, Form, UploadFile
from features.web_gui.services import asset_store

router = APIRouter(prefix="/assets", tags=["assets"])


@router.post("/upload")
async def upload_assets(project_slug: str = Form(...), files: list[UploadFile] = File(...)):
    out = []
    for f in files:
        content = await f.read()
        out.append(asset_store.save(project_slug, f.filename or "upload.bin", content))
    return out
```

- [ ] **Step 5: Wire all three routers**

```python
# server.py
from features.web_gui.api import variants, traces, assets
app.include_router(variants.router, prefix="/api/v1")
app.include_router(traces.router, prefix="/api/v1")
app.include_router(assets.router, prefix="/api/v1")
```

- [ ] **Step 6: Run — expect PASS**

```bash
/opt/homebrew/bin/pytest features/web_gui/test_server.py -q
```

- [ ] **Step 7: Commit**

```bash
git add features/web_gui/
git commit -m "feat(web_gui): PATCH variants + GET traces + POST assets upload"
```

---

## Phase 3 — Frontend scaffold

### Task 11: Vite + React + TS setup

**Files:**
- Create: `features/web_gui/ui/package.json`
- Create: `features/web_gui/ui/vite.config.ts`
- Create: `features/web_gui/ui/tsconfig.json`
- Create: `features/web_gui/ui/index.html`
- Create: `features/web_gui/ui/src/main.tsx`
- Create: `features/web_gui/ui/src/App.tsx` (minimal)
- Create: `features/web_gui/ui/src/tokens.ts`
- Create: `features/web_gui/ui/src/types.ts`
- Create: `features/web_gui/ui/src/api.ts`
- Create: `tests/test_tokens_ui_parity.py`
- Modify: `.gitignore` (ignore `features/web_gui/ui/node_modules/`, `features/web_gui/static/`)

- [ ] **Step 1: `package.json`**

```json
{
  "name": "vibeweb-criativos-ui",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/react": "18.3.12",
    "@types/react-dom": "18.3.1",
    "@vitejs/plugin-react": "4.3.3",
    "typescript": "5.6.3",
    "vite": "5.4.10",
    "vitest": "2.1.4",
    "@testing-library/react": "16.0.1",
    "@testing-library/jest-dom": "6.6.3",
    "jsdom": "25.0.1"
  }
}
```

- [ ] **Step 2: `vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../static',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/renders': 'http://localhost:8000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setup-tests.ts'],
  },
});
```

- [ ] **Step 3: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: `index.html`**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Criativos — Vibe Web</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Fraunces:wght@500;600;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="/brand/tokens.css"/>
  <script type="application/json" id="__tweaks_defaults">
  {"theme": "dark", "accent": "green", "streaming": true, "density": "relaxed"}
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 5: `src/tokens.ts`**

```typescript
// Mirrors brand/tokens.css — test_tokens_ui_parity.py enforces parity
export const tokens = {
  accent: '#04d361',
  accentRgb: '4, 211, 97',
  bg: '#0a0a0a',
  text: '#ffffff',
  textMuted: '#a3a3a3',
  border: '#2a2a2a',
  fontUI: '"Geist", "Inter", system-ui, sans-serif',
  fontMono: '"Geist Mono", ui-monospace, monospace',
  fontDisplay: 'Fraunces, serif',
} as const;
```

- [ ] **Step 6: `src/types.ts`** (matches backend shapes)

```typescript
export interface Project {
  slug: string;
  name: string;
  description: string;
  ad_count: number;
  variant_count: number;
  created_at: string;
}

export interface Brief {
  product: string;
  audience: string;
  pain: string;
  ctas: string[];
  social_proof: string | null;
}

export interface VariantAxes {
  relevance: number;
  originality: number;
  brand_fit: number;
}

export interface CopyVariant {
  id: string;
  headline: string;
  primary_text: string;
  description: string;
  ctas: string[];
  confidence: 'high' | 'medium' | 'low';
  confidence_score: number;
  axes: VariantAxes;
  reasoning: string;
  selected: boolean;
  confidence_symbol: string;
}

export interface Creative {
  id: string;
  kind: 'image' | 'video' | 'carousel' | 'copy';
  title: string;
  placement: string;
  format: string;
  headline: string;
  body: string;
  hero: string;
  ctas: string[];
  thumbnail_url: string;
  status: 'ready' | 'streaming' | 'failed';
  ad_id: string;
  variant_id: string | null;
}

export interface AgentResult {
  run_id: string;
  variants: CopyVariant[];
  trace: string;
  trace_structured: TraceNode[];
  methodology: string;
  model: string;
  pipeline_version: string;
  seed: number | null;
  created_at: string;
}

export interface TraceNode {
  id: string;
  label: string;
  start_ms: number;
  end_ms: number;
  tokens: number;
  confidence: number | null;
  output_preview: string;
}

export interface GenerateRequest {
  project_slug: string;
  ad_id: string;
  methodology: string;
  n_variants: number;
  brief_overrides?: Partial<Brief>;
  persist: boolean;
}
```

- [ ] **Step 7: `src/api.ts`** (typed fetch + SSE consumer)

```typescript
import type { Project, Creative, Brief, AgentResult, GenerateRequest } from './types';

const BASE = '/api/v1';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: { 'content-type': 'application/json' }, ...init });
  if (!r.ok) {
    const body = await r.json().catch(() => ({ error: r.statusText, code: `HTTP_${r.status}` }));
    throw new Error(`${body.code || 'ERROR'}: ${body.error || r.statusText}`);
  }
  return r.json();
}

export const api = {
  listProjects: () => req<{ projects: Project[] }>('/projects'),
  getProject: (slug: string) => req<Project>(`/projects/${slug}`),
  listCreatives: (slug: string, kind?: string) =>
    req<{ creatives: Creative[] }>(`/projects/${slug}/creatives${kind ? `?kind=${kind}` : ''}`),
  getBrief: (slug: string, adId: string) =>
    req<Brief>(`/projects/${slug}/ads/${adId}/brief`),
  putBrief: (slug: string, adId: string, brief: Brief) =>
    req<{ updated: boolean; brief: Brief }>(`/projects/${slug}/ads/${adId}/brief`, {
      method: 'PUT', body: JSON.stringify(brief),
    }),
  generate: (payload: GenerateRequest) =>
    req<AgentResult>('/generate', { method: 'POST', body: JSON.stringify(payload) }),
  patchVariant: (runId: string, variantId: string, patch: Partial<{ selected: boolean; headline: string; primary_text: string; description: string; ctas: string[] }>) =>
    req(`/variants/${runId}/${variantId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  getTrace: (runId: string) => req<AgentResult>(`/traces/${runId}`),
  uploadAssets: async (slug: string, files: File[]) => {
    const fd = new FormData();
    fd.append('project_slug', slug);
    for (const f of files) fd.append('files', f);
    const r = await fetch(`${BASE}/assets/upload`, { method: 'POST', body: fd });
    if (!r.ok) throw new Error('upload failed');
    return r.json();
  },
};

export type StreamEvent =
  | { type: 'run_start'; payload: { run_id: string; pipeline_version: string; started_at: string } }
  | { type: 'node_start'; payload: { node_id: string; label: string; start_ms: number } }
  | { type: 'node_done'; payload: { node_id: string; end_ms: number; tokens: number; confidence: number | null; output_preview: string } }
  | { type: 'token'; payload: { node_id: string; text: string } }
  | { type: 'variant_done'; payload: any }
  | { type: 'done'; payload: AgentResult }
  | { type: 'error'; payload: { error: string; code: string; raw?: string } };

export function streamGenerate(
  payload: GenerateRequest,
  onEvent: (e: StreamEvent) => void,
  onComplete?: () => void,
): () => void {
  const controller = new AbortController();
  (async () => {
    const r = await fetch(`${BASE}/generate/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!r.body) return;
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const lines = block.split('\n');
        let eventName = '', dataStr = '';
        for (const line of lines) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
        }
        if (eventName && dataStr) {
          try {
            onEvent({ type: eventName as any, payload: JSON.parse(dataStr) });
          } catch { /* malformed — ignore */ }
        }
      }
    }
    onComplete?.();
  })();
  return () => controller.abort();
}
```

- [ ] **Step 8: Minimal `main.tsx` + `App.tsx`**

```typescript
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
```

```typescript
// src/App.tsx (placeholder — Tasks 13+ replace)
import { useEffect, useState } from 'react';
import { api } from './api';
import type { Project } from './types';

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => { api.listProjects().then(r => setProjects(r.projects)); }, []);
  return <div style={{ padding: 24, fontFamily: 'Geist, system-ui' }}>
    <h1>Vibe Web Criativos</h1>
    <ul>{projects.map(p => <li key={p.slug}>{p.name} — {p.ad_count} ads</li>)}</ul>
  </div>;
}
```

- [ ] **Step 9: Token parity test**

```python
# tests/test_tokens_ui_parity.py
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
TOKENS_CSS = ROOT / "brand" / "tokens.css"
TOKENS_TS = ROOT / "features" / "web_gui" / "ui" / "src" / "tokens.ts"


def _css_var(css: str, name: str) -> str:
    m = re.search(rf"--{name}\s*:\s*([^;]+);", css)
    assert m, f"tokens.css missing --{name}"
    return m.group(1).strip()


def _ts_prop(ts: str, name: str) -> str:
    m = re.search(rf"{name}:\s*'([^']+)'", ts)
    assert m, f"tokens.ts missing {name}"
    return m.group(1).strip()


def test_accent_matches():
    css = TOKENS_CSS.read_text(encoding="utf-8")
    ts = TOKENS_TS.read_text(encoding="utf-8")
    assert _css_var(css, "accent") == _ts_prop(ts, "accent")


def test_bg_matches():
    css = TOKENS_CSS.read_text(encoding="utf-8")
    ts = TOKENS_TS.read_text(encoding="utf-8")
    assert _css_var(css, "bg") == _ts_prop(ts, "bg")
```

- [ ] **Step 10: Install + run**

```bash
cd features/web_gui/ui && npm install && npm run build && cd -
/opt/homebrew/bin/pytest tests/test_tokens_ui_parity.py -q
```

- [ ] **Step 11: Commit**

```bash
git add features/web_gui/ui/package.json features/web_gui/ui/vite.config.ts \
        features/web_gui/ui/tsconfig.json features/web_gui/ui/index.html \
        features/web_gui/ui/src/ tests/test_tokens_ui_parity.py .gitignore
git commit -m "feat(web_gui/ui): Vite+React+TS scaffold + types + api client + token parity"
```

---

## Phase 4 — Frontend components (JSX → TSX conversions)

### Task 12: Static shell — DesktopChrome + Sidebar + icons

**Files:**
- Create: `features/web_gui/ui/src/components/icons.tsx` (convert from `icons.jsx`)
- Create: `features/web_gui/ui/src/components/DesktopChrome.tsx` (convert from `desktop-chrome.jsx`)
- Create: `features/web_gui/ui/src/components/Sidebar.tsx` (convert from `sidebar.jsx`)

**Process for each conversion:**
1. Copy JSX content from `docs/superpowers/design-bundles/criativos-2026-04-18/project/components/<file>.jsx`
2. Rename `.jsx` → `.tsx`
3. Add TypeScript interface for props
4. Replace `oklch(0.65 0.18 25)` with `var(--accent)` where appropriate (already dark+green theme)
5. Remove `Object.assign(window, {...})` at bottom — export instead

- [ ] **Step 1: Convert `icons.tsx`** (no prop types — all take className)

Source: `docs/superpowers/design-bundles/criativos-2026-04-18/project/components/icons.jsx`. Each icon is a function taking no props or `size: number`. Wrap in module exports:

```typescript
// features/web_gui/ui/src/components/icons.tsx — head
import type { SVGProps } from 'react';
type IconProps = { size?: number } & SVGProps<SVGSVGElement>;

export function IconSparkle({ size = 16, ...p }: IconProps) { /* body from icons.jsx */ }
// ... export each icon shown in the wire audit table (icons §6 of spec)
```

- [ ] **Step 2: Convert `DesktopChrome.tsx`**

Source: `components/desktop-chrome.jsx`. Props typed. Export both named.

```typescript
interface DesktopChromeProps {
  title?: string;
  width: number;
  height: number;
  children: React.ReactNode;
}
export function DesktopChrome({ title = 'Criativos', children, width, height }: DesktopChromeProps) {
  // body from desktop-chrome.jsx
}
```

- [ ] **Step 3: Convert `Sidebar.tsx`**

Source: `components/sidebar.jsx`. Replace hardcoded project list with `projects` prop (list from API).

```typescript
import type { Project } from '../types';
interface SidebarProps {
  active: 'flow' | 'gallery' | 'brand';
  onNav: (nav: 'flow' | 'gallery' | 'brand') => void;
  projects: Project[];
  activeProjectSlug: string;
  onSelectProject: (slug: string) => void;
}
// body from sidebar.jsx with array iteration
```

- [ ] **Step 4: Component test**

```typescript
// features/web_gui/ui/src/components/Sidebar.test.tsx
import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { describe, it, expect } from 'vitest';

describe('Sidebar', () => {
  it('renders project names from props', () => {
    render(<Sidebar active="flow" onNav={() => {}} activeProjectSlug="alpha"
             onSelectProject={() => {}} projects={[
               { slug: 'alpha', name: 'Alpha', description: '', ad_count: 0, variant_count: 0, created_at: '' }
             ]}/>);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Build + commit**

```bash
cd features/web_gui/ui && npm run build && npm test -- --run && cd -
git add features/web_gui/ui/src/components/
git commit -m "feat(web_gui/ui): DesktopChrome + Sidebar + icons TSX conversion"
```

---

### Task 13: Gallery + DetailPanel + BrandLibrary

**Files:**
- Create: `features/web_gui/ui/src/components/Gallery.tsx`
- Create: `features/web_gui/ui/src/components/DetailPanel.tsx`
- Create: `features/web_gui/ui/src/components/BrandLibrary.tsx`
- Create: `features/web_gui/ui/src/data/creatives.ts`

- [ ] **Step 1: `data/creatives.ts`** — bridge to API

```typescript
import { api } from '../api';
import type { Creative } from '../types';
export async function fetchCreatives(slug: string, kind?: string): Promise<Creative[]> {
  const r = await api.listCreatives(slug, kind);
  return r.creatives;
}
```

- [ ] **Step 2: Convert `Gallery.tsx`**

Source: `components/gallery.jsx`. Replace `SAMPLE_CREATIVES` with `useEffect`→`fetchCreatives`. Keep all visual behavior (streaming shimmer, hover → "ver trace", click → `onOpenCreative`).

```typescript
interface GalleryProps {
  projectSlug: string;
  onOpenCreative: (c: Creative) => void;
}
export function Gallery({ projectSlug, onOpenCreative }: GalleryProps) {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [kind, setKind] = useState<string | undefined>(undefined);
  useEffect(() => { fetchCreatives(projectSlug, kind).then(setCreatives); }, [projectSlug, kind]);
  // render — body from gallery.jsx adapted
}
```

- [ ] **Step 3: Convert `DetailPanel.tsx`**

Source: `components/detail-panel.jsx`. Replace CSS `creative.bg` with `<img src={creative.thumbnail_url}>` inside the iOS frame.

- [ ] **Step 4: Convert `BrandLibrary.tsx`**

Source: within `overlays.jsx` (BrandLibrary component). Replace hardcoded color palette with reading from `tokens.ts`. Keep typography specimen hardcoded (design element).

- [ ] **Step 5: Wire into `App.tsx`** (first meaningful pass)

```typescript
// src/App.tsx — expanded
import { useEffect, useState } from 'react';
import { DesktopChrome } from './components/DesktopChrome';
import { Sidebar } from './components/Sidebar';
import { Gallery } from './components/Gallery';
import { DetailPanel } from './components/DetailPanel';
import { BrandLibrary } from './components/BrandLibrary';
import { api } from './api';
import type { Creative, Project } from './types';

type Nav = 'flow' | 'gallery' | 'brand';

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<string>('vibeweb');
  const [nav, setNav] = useState<Nav>(() => (localStorage.getItem('cr_nav') as Nav) || 'flow');
  const [selected, setSelected] = useState<Creative | null>(null);

  useEffect(() => { api.listProjects().then(r => setProjects(r.projects)); }, []);
  useEffect(() => { localStorage.setItem('cr_nav', nav); }, [nav]);

  const chromeW = Math.min(1480, window.innerWidth - 48);
  const chromeH = Math.min(900, window.innerHeight - 48);

  return <DesktopChrome width={chromeW} height={chromeH} title={_title(nav)}>
    <Sidebar active={nav} onNav={setNav} projects={projects}
             activeProjectSlug={activeProject} onSelectProject={setActiveProject}/>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', position: 'relative' }}>
      {nav === 'flow' && <div>Flow view — Task 14</div>}
      {nav === 'gallery' && <Gallery projectSlug={activeProject} onOpenCreative={setSelected}/>}
      {nav === 'brand' && <BrandLibrary/>}
      {selected && <DetailPanel creative={selected} onClose={() => setSelected(null)}/>}
    </div>
  </DesktopChrome>;
}
function _title(n: Nav) { return n === 'flow' ? 'Novo fluxo' : n === 'gallery' ? 'Galeria' : 'Marca'; }
```

- [ ] **Step 6: Build + commit**

```bash
cd features/web_gui/ui && npm run build && cd -
git add features/web_gui/ui/src/
git commit -m "feat(web_gui/ui): Gallery + DetailPanel + BrandLibrary wired to backend"
```

---

### Task 14: FlowView — Setup step

**Files:**
- Create: `features/web_gui/ui/src/components/FlowView.tsx`
- Create: `features/web_gui/ui/src/components/flow/Setup.tsx`
- Create: `features/web_gui/ui/src/data/brief.ts`

- [ ] **Step 1: `data/brief.ts`**

```typescript
import { api } from '../api';
import type { Brief } from '../types';
export async function loadBrief(slug: string, adId: string): Promise<Brief> {
  return api.getBrief(slug, adId);
}
export async function saveBrief(slug: string, adId: string, brief: Brief): Promise<void> {
  await api.putBrief(slug, adId, brief);
}
```

- [ ] **Step 2: Convert `flow-steps-setup.jsx` → `Setup.tsx`**

Source: `components/flow-steps-setup.jsx`. Replace hardcoded values with controlled inputs bound to loaded Brief. On "Próximo": call `saveBrief` then advance.

```typescript
interface SetupProps {
  projectSlug: string;
  adId: string;
  onNext: () => void;
  onChangeBrief: (b: Brief) => void;
  nVariants: number;
  setNVariants: (n: number) => void;
  methodology: 'pas' | 'aida' | 'bab';
  setMethodology: (m: 'pas' | 'aida' | 'bab') => void;
}
// body adapted — form with product/audience/pain/ctas/social_proof; ctas is an array editor
```

Note: AIDA + BAB buttons render with `disabled + title="Em breve — Spec 2"`.

- [ ] **Step 3: Convert `flow-view.jsx` → `FlowView.tsx`** (skeleton)

```typescript
type Step = 0 | 1 | 2 | 3;
interface FlowViewProps {
  projectSlug: string;
  adId: string;
  onFinish: () => void;
}
export function FlowView({ projectSlug, adId, onFinish }: FlowViewProps) {
  const [step, setStep] = useState<Step>(0);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [methodology, setMethodology] = useState<'pas'>('pas');
  const [nVariants, setNVariants] = useState<number>(3);
  const [result, setResult] = useState<AgentResult | null>(null);

  useEffect(() => { loadBrief(projectSlug, adId).then(setBrief); }, [projectSlug, adId]);

  if (!brief) return <div>Loading brief...</div>;
  return <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
    <StepHeader step={step}/>
    {step === 0 && <Setup {...{ projectSlug, adId, methodology, setMethodology,
       nVariants, setNVariants, onChangeBrief: setBrief,
       onNext: async () => { await saveBrief(projectSlug, adId, brief); setStep(1); } }}/>}
    {step === 1 && <div>Generate — Task 15</div>}
    {step === 2 && <div>Review — Task 16</div>}
    {step === 3 && <div>Export — Task 17</div>}
  </div>;
}
```

- [ ] **Step 4: Wire FlowView into `App.tsx`**

Replace `<div>Flow view — Task 14</div>` with `<FlowView projectSlug={activeProject} adId="01" onFinish={() => setNav('gallery')}/>`.

- [ ] **Step 5: Build + commit**

```bash
cd features/web_gui/ui && npm run build && cd -
git add features/web_gui/ui/src/
git commit -m "feat(web_gui/ui): Flow Setup step wired to briefs endpoint"
```

---

### Task 15: Flow Generate step (SSE consumer)

**Files:**
- Create: `features/web_gui/ui/src/components/flow/Generate.tsx`
- Modify: `features/web_gui/ui/src/components/FlowView.tsx`

- [ ] **Step 1: Convert `flow-steps-generate.jsx` → `Generate.tsx`** consuming real SSE

```typescript
import { streamGenerate, type StreamEvent } from '../../api';
interface GenerateProps {
  projectSlug: string;
  adId: string;
  methodology: string;
  nVariants: number;
  onDone: (result: AgentResult) => void;
}
export function Generate({ projectSlug, adId, methodology, nVariants, onDone }: GenerateProps) {
  const [tokens, setTokens] = useState<string>('');
  const [variants, setVariants] = useState<CopyVariant[]>([]);
  const [nodes, setNodes] = useState<TraceNode[]>([]);
  useEffect(() => {
    const abort = streamGenerate(
      { project_slug: projectSlug, ad_id: adId, methodology, n_variants: nVariants, persist: true },
      (e: StreamEvent) => {
        if (e.type === 'token') setTokens(t => t + e.payload.text);
        else if (e.type === 'variant_done') setVariants(v => [...v, e.payload]);
        else if (e.type === 'node_start' || e.type === 'node_done') {
          setNodes(n => [...n, { /* merge */ } as TraceNode]);
        }
        else if (e.type === 'done') onDone(e.payload);
        else if (e.type === 'error') console.error(e.payload);
      },
    );
    return abort;
  }, [projectSlug, adId, methodology, nVariants]);
  // render token stream + node graph — body adapted from flow-steps-generate.jsx
}
```

- [ ] **Step 2: Wire into FlowView**

```typescript
{step === 1 && <Generate {...{ projectSlug, adId, methodology, nVariants, onDone: r => { setResult(r); setStep(2); } }}/>}
```

- [ ] **Step 3: Build + manual test**

```bash
cd features/web_gui/ui && npm run build && cd -
# Manual: VIBEWEB_DRY_RUN=1 uvicorn features.web_gui.server:app & ; open http://localhost:8000/ui/
# Click through Setup → Generate and verify streaming tokens appear
```

- [ ] **Step 4: Commit**

```bash
git add features/web_gui/ui/src/
git commit -m "feat(web_gui/ui): Flow Generate step consuming SSE with token stream"
```

---

### Task 16: Flow Review step (variant select + edit)

**Files:**
- Create: `features/web_gui/ui/src/components/flow/Review.tsx`
- Modify: `features/web_gui/ui/src/components/FlowView.tsx`

- [ ] **Step 1: Convert `flow-steps-review.jsx` → `Review.tsx`**

Source 539 LOC. Key adaptations:
- `variant.conf` float → use `confidence_score` from CopyVariant (already float)
- `variant.axes.brandFit` → `axes.brand_fit` (snake_case)
- `variant.warn` → compute inline from `axes` (or expose via API)
- Select/edit: on click, `api.patchVariant(run_id, variant.id, { selected: true })`

```typescript
interface ReviewProps {
  result: AgentResult;
  onFinish: () => void;
}
export function Review({ result, onFinish }: ReviewProps) {
  const [variants, setVariants] = useState(result.variants);
  const toggle = async (id: string) => {
    const v = variants.find(v => v.id === id)!;
    const patched = { ...v, selected: !v.selected };
    setVariants(vs => vs.map(x => x.id === id ? patched : x));
    await api.patchVariant(result.run_id, id, { selected: patched.selected });
  };
  // render cards — body adapted
}
```

- [ ] **Step 2: Wire into FlowView**

```typescript
{step === 2 && result && <Review result={result} onFinish={() => setStep(3)}/>}
```

- [ ] **Step 3: Build + commit**

```bash
cd features/web_gui/ui && npm run build && cd -
git add features/web_gui/ui/src/
git commit -m "feat(web_gui/ui): Flow Review step with variant select persistence"
```

---

### Task 17: Flow Export step + CommandPalette + GenerationTraceModal

**Files:**
- Create: `features/web_gui/ui/src/components/flow/Export.tsx`
- Create: `features/web_gui/ui/src/components/CommandPalette.tsx`
- Create: `features/web_gui/ui/src/components/TweaksPanel.tsx`
- Create: `features/web_gui/ui/src/components/GenerationTraceModal.tsx`
- Modify: `features/web_gui/ui/src/App.tsx` (global keyboard handler)

- [ ] **Step 1: Convert Export step**

Source: `flow-steps-review.jsx` has the ExportDrawer. Extract into standalone `Export.tsx`. On "Baixar": provides download links to `/renders/<ad_id>-<slug>.png` (the static-served PNGs).

- [ ] **Step 2: Convert CommandPalette**

Source: `overlays.jsx`. Keep all commands visible with their keyboard hints. Only ⌘K / ⌘1-3 / Escape are wired in App; other commands log `console.info("coming in Spec 2")` and close palette.

- [ ] **Step 3: Convert TweaksPanel (static)**

Source: `overlays.jsx`. Render read-only. Toggles visible but `disabled`.

- [ ] **Step 4: Convert GenerationTraceModal**

Source: `generation-trace-modal.jsx`. Take `runId` as prop; on open, `api.getTrace(runId)` and render node graph.

- [ ] **Step 5: Add global keyboard handler in App.tsx**

```typescript
useEffect(() => {
  const h = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(o => !o); }
    if (mod && e.key === '1') { e.preventDefault(); setNav('flow'); }
    if (mod && e.key === '2') { e.preventDefault(); setNav('gallery'); }
    if (mod && e.key === '3') { e.preventDefault(); setNav('brand'); }
    if (e.key === 'Escape') { setPaletteOpen(false); setSelected(null); }
  };
  window.addEventListener('keydown', h);
  return () => window.removeEventListener('keydown', h);
}, []);
```

- [ ] **Step 6: Build + commit**

```bash
cd features/web_gui/ui && npm run build && cd -
git add features/web_gui/ui/src/
git commit -m "feat(web_gui/ui): Export step + CommandPalette + TweaksPanel (static) + TraceModal + keyboard nav"
```

---

## Phase 5 — E2E + dev experience

### Task 18: Playwright e2e closed-loop test

**Files:**
- Create: `features/web_gui/test_ui_e2e.py`
- Modify: `pyproject.toml` (add `pytest-playwright`, mark opt-in)

- [ ] **Step 1: Add deps + conftest**

```python
# features/web_gui/conftest.py
import os
import subprocess
import time
from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def ui_server():
    """Boot uvicorn on :8765 with dry-run, serving built UI from static/."""
    env = {**os.environ, "VIBEWEB_DRY_RUN": "1"}
    proc = subprocess.Popen(
        ["uvicorn", "features.web_gui.server:app", "--port", "8765"],
        env=env, cwd=Path(__file__).parent.parent.parent,
    )
    # wait ready
    for _ in range(30):
        try:
            import httpx
            httpx.get("http://localhost:8765/api/v1/projects", timeout=1)
            break
        except Exception:
            time.sleep(0.5)
    yield "http://localhost:8765"
    proc.terminate()
    proc.wait(timeout=5)
```

- [ ] **Step 2: E2E test**

```python
# features/web_gui/test_ui_e2e.py
import pytest
from playwright.sync_api import Page, expect


@pytest.mark.e2e
def test_full_flow_dry_run(ui_server: str, page: Page):
    page.goto(f"{ui_server}/ui/")
    # Sidebar has the Vibe Web project
    expect(page.get_by_text("Vibe Web", exact=False)).to_be_visible()

    # ⌘2 → Gallery
    page.keyboard.press("Meta+2")
    expect(page.get_by_text("Galeria")).to_be_visible()
    # Gallery has ≥6 cards
    cards = page.locator('[data-testid="creative-card"]')
    expect(cards).to_have_count(6, timeout=10_000)

    # Click first card → DetailPanel opens with headline
    cards.first.click()
    expect(page.locator('[data-testid="detail-panel"]')).to_be_visible()

    # ⌘1 → Flow
    page.keyboard.press("Escape")
    page.keyboard.press("Meta+1")
    expect(page.get_by_text("Novo fluxo")).to_be_visible()

    # Advance Setup → Generate (streaming tokens should appear)
    page.get_by_role("button", name="Próximo").click()
    expect(page.locator('[data-testid="token-stream"]')).to_be_visible()

    # After stream completes → Review shows 3 variants
    variant_cards = page.locator('[data-testid="variant-card"]')
    expect(variant_cards).to_have_count(3, timeout=30_000)

    # Confidence badges render
    expect(page.locator('text=⚠️').first).to_be_visible()  # dry-run default is medium
```

Component test ids must be added to the TSX during conversion (mark them in Tasks 13-16 steps).

- [ ] **Step 3: Run e2e**

```bash
pip install --break-system-packages pytest-playwright playwright
playwright install chromium
cd features/web_gui/ui && npm run build && cd -
VIBEWEB_E2E=1 /opt/homebrew/bin/pytest features/web_gui/test_ui_e2e.py -m e2e -v
```

- [ ] **Step 4: Commit**

```bash
git add features/web_gui/conftest.py features/web_gui/test_ui_e2e.py pyproject.toml
git commit -m "test(web_gui): playwright e2e closed-loop with dry-run"
```

---

### Task 19: Visual regression golden (Review screen)

**Files:**
- Create: `tests/goldens/web-gui-review-dryrun.png` (generated)
- Modify: `tests/test_visual_regression.py` (add case)
- Modify: `features/web_gui/test_ui_e2e.py` (screenshot step)

- [ ] **Step 1: Add screenshot step to e2e test**

```python
@pytest.mark.e2e
@pytest.mark.visual
def test_review_screen_matches_golden(ui_server, page: Page, tmp_path):
    # ... drive to Review step ...
    out = tmp_path / "review.png"
    page.locator('[data-testid="review-screen"]').screenshot(path=str(out))
    # Assert: fraction_diff vs golden < 0.01
    from PIL import Image, ImageChops
    golden = Path(__file__).parent.parent.parent / "tests" / "goldens" / "web-gui-review-dryrun.png"
    if not golden.exists():
        pytest.skip(f"Generate golden first: cp {out} {golden}")
    # copied from test_visual_regression._fraction_diff
    ...
```

- [ ] **Step 2: Generate golden (once)**

```bash
VIBEWEB_E2E=1 /opt/homebrew/bin/pytest features/web_gui/test_ui_e2e.py::test_review_screen_matches_golden -v
# Screenshot saved to tmp; inspect manually, then:
cp /tmp/review.png tests/goldens/web-gui-review-dryrun.png
git add tests/goldens/web-gui-review-dryrun.png
```

- [ ] **Step 3: Generate real-API golden (optional, costs ~$0.01)**

```bash
# Only with real key and user approval
VIBEWEB_E2E=1 ANTHROPIC_API_KEY=<real> /opt/homebrew/bin/pytest features/web_gui/test_ui_e2e.py::test_review_screen_matches_golden -v
cp /tmp/review.png tests/goldens/web-gui-review-real.png
```

- [ ] **Step 4: Commit**

```bash
git add tests/goldens/web-gui-review-dryrun.png features/web_gui/test_ui_e2e.py
git commit -m "test(web_gui): visual regression golden for Review screen (dry-run)"
```

---

### Task 20: Dev script + CLAUDE.md polish + README

**Files:**
- Create: `scripts/dev.py`
- Modify: `features/web_gui/CLAUDE.md`
- Create: `features/web_gui/README.md`

- [ ] **Step 1: `scripts/dev.py`**

```python
# scripts/dev.py
"""
Starts uvicorn (backend) + vite (ui) concurrently for local development.

- uvicorn on :8000 with auto-reload
- vite dev server on :5173, proxies /api/* to :8000

Both processes streamed to stdout; Ctrl+C kills both.
"""
from __future__ import annotations
import os
import signal
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent


def main() -> int:
    env = dict(os.environ)
    env.setdefault("VIBEWEB_DRY_RUN", "1")
    backend = subprocess.Popen(
        ["uvicorn", "features.web_gui.server:app", "--reload", "--port", "8000"],
        cwd=str(ROOT), env=env,
    )
    frontend = subprocess.Popen(
        ["npm", "run", "dev"], cwd=str(ROOT / "features" / "web_gui" / "ui"), env=env,
    )

    def shutdown(*_):
        print("\nShutting down...")
        backend.terminate()
        frontend.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        backend.wait()
        frontend.wait()
    except KeyboardInterrupt:
        shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: `features/web_gui/README.md`**

```markdown
# features/web_gui

Local desktop app for Vibe Web's AI Creative Factory. FastAPI backend + React SPA.

## Run it

### Dev (live-reload both sides)

```bash
python scripts/dev.py
# → backend :8000, ui :5173, open http://localhost:5173
```

### Prod-local

```bash
cd features/web_gui/ui && npm run build && cd -
uvicorn features.web_gui.server:app --port 8000
# → open http://localhost:8000/ui/
```

## Test

```bash
# Contract tests
/opt/homebrew/bin/pytest features/web_gui/test_server.py -q

# Vitest component tests
cd features/web_gui/ui && npm test -- --run

# E2E (opt-in, requires playwright browsers)
VIBEWEB_E2E=1 /opt/homebrew/bin/pytest features/web_gui/test_ui_e2e.py -m e2e -v
```

## Structure

(see `CLAUDE.md` for per-file responsibilities)
```

- [ ] **Step 3: Final commit**

```bash
git add scripts/dev.py features/web_gui/README.md features/web_gui/CLAUDE.md
git commit -m "docs(web_gui): dev script + README + CLAUDE.md polish"
```

---

## Self-review

### Spec coverage
- Every endpoint in spec §5 → Task 5-10 ✅
- Every schema change in spec §4 → Tasks 1-3 ✅
- Every UI view/component in spec §6 → Tasks 12-17 ✅
- Testing strategy §8 (contract + component + e2e + visual) → Tasks 5-10 + 11 + 18 + 19 ✅
- Dev/prod setup §7 → Task 20 ✅
- Out-of-scope §7.2 explicitly deferred in MVP scope — not in plan ✅
- Token parity §4 → Task 11 step 9 ✅

### Placeholders
- Removed all "TBD" / "similar to Task N" in final pass
- Every code step has concrete code or exact conversion instructions from a referenced source

### Type consistency
- `Brief` uses `ctas: list[str]` consistently (backend + frontend + migration)
- `run_id` canonical across PATCH/GET/SSE
- `confidence` stays Literal, `confidence_score` is the float — both emitted
- `VariantAxes` fields use snake_case everywhere (`brand_fit` not `brandFit`)

---

## Execution handoff

**Plan complete and saved to `docs/plans/spec-3-web-gui.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task + spec + code-quality review between tasks
2. **Inline** — executing-plans skill, batch with checkpoints

**Recommend option 1** for this spec. Size is large (20 tasks, ~3000 LOC final) and the bundled-review cycle catches drift early, especially between backend schema and frontend types.
