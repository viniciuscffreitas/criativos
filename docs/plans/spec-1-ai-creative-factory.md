# Spec 1 — AI Creative Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the deterministic PNG renderer into the foundation of an LLM-driven creative factory — copy extracted to `config/ads.yaml`, templates migrated to Jinja2, `features/copy_generation/` skeleton wired for Claude API with dry-run mode.

**Architecture:** Vertical slice under `features/copy_generation/` (agent + methodologies + schema + prompts). Ads rendering stays in `ads/` for Spec 1 — only gains a Jinja2 step that reads copy from the YAML config. Brand templates (`brand/social/templates/`) are out of scope here (Spec 2 territory). The agent writes variants back to YAML; rendering is pure function of `(template.j2 + config entry) → HTML → Playwright → PNG`.

**Tech Stack:** Python 3.11+, Jinja2 (template engine), PyYAML (config), Anthropic SDK (Claude API), Playwright (render), pytest (tests), Pillow (visual diff).

---

## Spec reference

All design decisions, rationale, and out-of-scope items are locked in `docs/superpowers/specs/2026-04-17-ai-creative-factory-design.md`. This plan executes that spec unchanged. The four pending questions noted in `CONTINUATION_PROMPT.md` are resolved by the spec itself:

| # | Question | Resolution in spec | Where |
|---|---|---|---|
| 1 | NPQEL definition | Stub file until user defines framework | §6 |
| 2 | Claude model | `claude-sonnet-4-6` | §5 |
| 3 | `variants_per_run` default | 3 | §7 |
| 4 | Cost tracking | Out of scope for Spec 1 | §11 |

## Baseline (must hold before starting)

- `pytest -q` → **171 passed** (3 fixes from 2026-04-18 session already merged in working tree: expanded goldens, silent-pass gate, copy-parity test).
- `python scripts/build.py --all` → 21 PNGs regenerated cleanly.
- Working directory is clean or changes are known.

## File Structure

### Create

| Path | Responsibility |
|---|---|
| `config/ads.yaml` | Structured copy for all 6 ads — brief, visual copy (what goes in the PNG), meta copy (what goes in Ads Manager), methodology tag, variant storage, run trace. Single source of truth after migration. |
| `tests/test_ads_config.py` | Structural test — YAML parses, every ad has required sections, IDs match filesystem, methodology is a known value. |
| `ads/templates/01-portfolio-grid.html.j2` | Jinja2 template. Same HTML as the current `.html`, with hardcoded copy strings replaced by `{{ copy.* }}` placeholders. No loops, no conditionals, no `{% %}` blocks — pure `{{ var }}` substitution. |
| `ads/templates/02-before-after.html.j2` | Same. |
| `ads/templates/03-social-proof.html.j2` | Same. |
| `ads/templates/04-price-objection.html.j2` | Same. |
| `ads/templates/05-mockup-showcase.html.j2` | Same. |
| `ads/templates/06-niche-designers.html.j2` | Same. |
| `ads/.rendered/` | Git-ignored output directory for Jinja2 → HTML intermediates. Assets resolve via `../assets/` (same parent as `ads/templates/`). |
| `features/__init__.py` | Empty — marks package for setuptools discovery. |
| `features/copy_generation/__init__.py` | Empty. |
| `features/copy_generation/CLAUDE.md` | ≤30 lines. What this feature does, inputs/outputs, non-obvious constraints (dry-run mode, env-var contract). |
| `features/copy_generation/schema.py` | Dataclasses: `Brief`, `CopyVariant`, `AgentResult`. Matches §4 of spec. |
| `features/copy_generation/agent.py` | Entry-point. `generate(brief, methodology, n=3) -> AgentResult`. Wraps anthropic SDK; falls back to deterministic stub when `ANTHROPIC_API_KEY` absent OR `VIBEWEB_DRY_RUN=1`. |
| `features/copy_generation/methodologies/__init__.py` | Registry — `by_name(name: str) -> Methodology`. Raises explicit `KeyError` with known names listed. |
| `features/copy_generation/methodologies/base.py` | `Methodology` Protocol + `Brief` import + `build_user_prompt` contract. |
| `features/copy_generation/methodologies/pas.py` | PAS live implementation. |
| `features/copy_generation/methodologies/npqel.py` | Placeholder — raises `NotImplementedError("NPQEL framework not defined — set the user-prompt template in prompts/npqel.md and implement build_user_prompt")` when called. |
| `features/copy_generation/prompts/system.md` | Base system prompt, cacheable across methodologies. |
| `features/copy_generation/prompts/pas.md` | PAS-specific user-prompt template (uses Python-side `.format()` with named fields, not Jinja — keep prompts decoupled from template engine). |
| `features/copy_generation/prompts/npqel.md` | Empty file with a single comment line. Presence is enough to unblock the import path. |
| `features/copy_generation/test_schema.py` | Unit tests — dataclass construction, `confidence` Literal validation. |
| `features/copy_generation/test_methodologies.py` | Unit tests — PAS builds expected prompt shape, NPQEL raises `NotImplementedError`, registry returns known methodologies. |
| `features/copy_generation/test_agent.py` | Unit tests — dry-run mode returns N variants deterministically, real-API path is skipped unless `ANTHROPIC_API_KEY` present, malformed JSON response raises with raw payload in the message. |

### Modify

| Path | Change |
|---|---|
| `pyproject.toml` | Add `jinja2>=3.1,<4.0`, `pyyaml>=6.0,<7.0`, `anthropic>=0.40,<1.0` to `dependencies`. Add `features*` to `[tool.setuptools.packages.find].include`. |
| `.gitignore` | Add `ads/.rendered/` line. |
| `ads/render.py` | Replace direct `TEMPLATES_DIR.glob("*.html")` with a pipeline that: (1) loads `config/ads.yaml`, (2) renders each `.html.j2` via Jinja2 into `ads/.rendered/NN-slug.html`, (3) builds `RenderJob` list pointing at the rendered HTML. `TEMPLATES_DIR` now globs `*.html.j2`. `SIZE`, `RENDERS_DIR`, `to_file_url` re-exports stay for test back-compat. |
| `tests/test_tokens_truth.py` | Line 20: `AD_TEMPLATES = sorted((ROOT / "ads" / "templates").glob("*.html.j2"))`. |
| `tests/test_copy_parity.py` | `_template_for(ad_num)` globs `f"{ad_num}-*.html.j2"`; `test_every_template_is_referenced_by_copy_md` globs `"[0-9][0-9]-*.html.j2"`. (Later this test becomes redundant — `config/ads.yaml` becomes the source of truth — but it stays in Spec 1 as transitional guard.) |
| `ads/test_render.py` | `TEMPLATES_DIR.glob("*.html.j2")` in `test_every_template_has_a_render` and `test_templates_directory_populated`. |

### Delete (only after corresponding `.j2` is verified visually)

| Path | When |
|---|---|
| `ads/templates/01-portfolio-grid.html` | End of Task 4. |
| `ads/templates/02-before-after.html` | End of Task 5. |
| `ads/templates/03-social-proof.html` | End of Task 5. |
| `ads/templates/04-price-objection.html` | End of Task 5. |
| `ads/templates/05-mockup-showcase.html` | End of Task 5. |
| `ads/templates/06-niche-designers.html` | End of Task 5. |

---

## Task 1 — Dependencies

**Files:**
- Modify: `pyproject.toml`
- Modify: `tests/test_packaging.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_packaging.py`:

```python
def test_pyproject_pins_spec1_deps():
    """Spec 1 introduces Jinja2 (templating), PyYAML (config), anthropic (LLM)."""
    with (ROOT / "pyproject.toml").open("rb") as f:
        data = tomllib.load(f)
    deps = {d.split(">=")[0].split("==")[0].split("~=")[0].strip()
            for d in data["project"]["dependencies"]}
    for required in ("jinja2", "pyyaml", "anthropic"):
        assert required in deps, f"{required} missing from [project].dependencies"


def test_wheel_includes_features_package():
    with (ROOT / "pyproject.toml").open("rb") as f:
        data = tomllib.load(f)
    include = data["tool"]["setuptools"]["packages"]["find"]["include"]
    assert "features*" in include, "features package missing from wheel"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
/opt/homebrew/bin/pytest -q tests/test_packaging.py
```

Expected: 2 failures — `jinja2/pyyaml/anthropic missing` and `features* missing`.

- [ ] **Step 3: Edit `pyproject.toml`**

Under `[project].dependencies`:
```toml
dependencies = [
    "playwright>=1.47,<2.0",
    "pillow>=10.4,<12.0",
    "jinja2>=3.1,<4.0",
    "pyyaml>=6.0,<7.0",
    "anthropic>=0.40,<1.0",
]
```

Under `[tool.setuptools.packages.find]`:
```toml
include = ["scripts*", "ads*", "features*"]
```

- [ ] **Step 4: Install new deps locally**

```bash
pip3 install -e ".[dev]"
```

- [ ] **Step 5: Run all tests**

```bash
/opt/homebrew/bin/pytest -q
```

Expected: 173 passed (171 baseline + 2 new).

- [ ] **Step 6: Commit**

```bash
git add pyproject.toml tests/test_packaging.py
git commit -m "build: add jinja2, pyyaml, anthropic + features package"
```

---

## Task 2 — `config/ads.yaml` with 6 ads

**Files:**
- Create: `config/ads.yaml`
- Create: `tests/test_ads_config.py`

- [ ] **Step 1: Write the failing test** (`tests/test_ads_config.py`)

```python
"""Structural validation of config/ads.yaml — shape, required fields, IDs match filesystem."""
from pathlib import Path
import pytest
import yaml

ROOT = Path(__file__).parent.parent
CONFIG = ROOT / "config" / "ads.yaml"
TEMPLATES_DIR = ROOT / "ads" / "templates"

EXPECTED_IDS = ["01", "02", "03", "04", "05", "06"]
KNOWN_METHODOLOGIES = {"pas", "npqel"}


def _data() -> dict:
    return yaml.safe_load(CONFIG.read_text(encoding="utf-8"))


def test_config_parses():
    data = _data()
    assert "ads" in data, "top-level 'ads' key missing"


def test_all_six_ads_present():
    ads = _data()["ads"]
    ids = sorted(a["id"] for a in ads.values())
    assert ids == EXPECTED_IDS, f"expected {EXPECTED_IDS}, got {ids}"


@pytest.mark.parametrize("ad_key", [
    "01_portfolio_grid", "02_before_after", "03_social_proof",
    "04_price_objection", "05_mockup_showcase", "06_niche_designers",
])
def test_ad_has_required_sections(ad_key):
    ad = _data()["ads"][ad_key]
    for section in ("id", "slug", "methodology", "brief", "copy", "meta"):
        assert section in ad, f"{ad_key}: missing section '{section}'"


@pytest.mark.parametrize("ad_key", [
    "01_portfolio_grid", "02_before_after", "03_social_proof",
    "04_price_objection", "05_mockup_showcase", "06_niche_designers",
])
def test_brief_has_required_fields(ad_key):
    brief = _data()["ads"][ad_key]["brief"]
    for field in ("product", "audience", "pain", "cta"):
        assert field in brief and brief[field], f"{ad_key}.brief.{field} empty"


def test_methodology_is_known():
    for key, ad in _data()["ads"].items():
        assert ad["methodology"] in KNOWN_METHODOLOGIES, (
            f"{key}: unknown methodology '{ad['methodology']}'"
        )


def test_ids_match_template_prefixes():
    yaml_ids = {a["id"] for a in _data()["ads"].values()}
    fs_ids = {p.name[:2] for p in TEMPLATES_DIR.glob("[0-9][0-9]-*.*")}
    assert yaml_ids == fs_ids, f"YAML ids {yaml_ids} != template prefixes {fs_ids}"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
/opt/homebrew/bin/pytest -q tests/test_ads_config.py
```

Expected: errors — `config/ads.yaml` doesn't exist.

- [ ] **Step 3: Create `config/ads.yaml`** with all 6 ads. Schema per ad:

```yaml
ads:
  01_portfolio_grid:
    id: "01"
    slug: portfolio-grid
    methodology: pas
    brief:
      product: "Custom websites from €450 in 7 days"
      audience: "European freelancers without a website"
      pain: "Losing clients to competitors with real sites"
      social_proof: "6 sites built last month"
      cta: "Message me"
    copy:
      # Everything that appears inside the PNG. Keys match {{ copy.* }} slots in template.
      headline_lead: "I built"
      headline_count: "6 sites"
      headline_tail: "last month."
      sub_lead: "Yours could be"
      sub_highlight: "next."
      cta: "From €450 · Done in 7 days"
    meta:
      # What Vini pastes into Meta Ads Manager.
      headline: "6 Sites Last Month. Yours Next?"
      primary_text: |
        Freelancers without a website lose clients every single day. Someone Googles you, finds nothing, and hires the next person with a real site.

        Meanwhile, I built 6 sites last month — all for freelancers like you. From €450, delivered in 7 days.

        Yours could be next. Message me.
      description: "Custom sites from €450. 7 days."
    variants: []
    trace:
      last_run: null
      confidence: null
```

Repeat for `02_before_after` through `06_niche_designers`. For each one, use the current hardcoded copy from the corresponding template HTML as the `copy.*` values, and use `ads/copy.md` as the source for `meta.*` values. Field names per template:

| Ad | `copy.*` keys (from template inspection) |
|---|---|
| 01 | `headline_lead`, `headline_count`, `headline_tail`, `sub_lead`, `sub_highlight`, `cta` |
| 02 | `hook_lead`, `hook_em`, `before_label`, `before_text`, `before_sub`, `stat1_val`, `stat1_lbl`, `stat2_val`, `stat2_lbl`, `stat3_val`, `stat3_lbl`, `cta` |
| 03 | `testimonial_lead`, `testimonial_highlight_line1`, `testimonial_highlight_line2`, `stat1_val`, `stat1_lbl`, `stat2_val`, `stat2_lbl`, `stat3_val`, `stat3_lbl`, `subtext` |
| 04 | `line1`, `price_old`, `line2`, `price_new`, `turnaround`, `cta_lead`, `cta_strong` |
| 05 | `badge`, `headline_lead`, `headline_em`, `bottom_item1`, `bottom_item2`, `bottom_item3`, `bottom_cta` |
| 06 | `niche_tag`, `headline_lead`, `headline_em`, `sub`, `cta_price`, `cta_days`, `cta_action` |

- [ ] **Step 4: Run tests**

```bash
/opt/homebrew/bin/pytest -q tests/test_ads_config.py
/opt/homebrew/bin/pytest -q tests/test_copy_parity.py
```

Expected: `test_ads_config.py` → 10 passed (1 parse + 1 ids + 6 sections + 1 methodology + 1 ids_match). `test_copy_parity.py` unchanged — 20 passed.

- [ ] **Step 5: Commit**

```bash
git add config/ads.yaml tests/test_ads_config.py
git commit -m "feat(config): extract ad copy to config/ads.yaml"
```

---

## Task 3 — Jinja2 render pipeline in `ads/render.py`

**Files:**
- Modify: `ads/render.py`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing test**

Append to `ads/test_render.py`:

```python
def test_jinja_render_produces_html_file(tmp_path, monkeypatch):
    """Given a minimal .j2 + config entry, the renderer writes HTML that Jinja evaluated."""
    from render import render_template_to_html

    tpl = tmp_path / "t.html.j2"
    tpl.write_text("<p>{{ copy.msg }}</p>", encoding="utf-8")
    out = render_template_to_html(tpl, {"msg": "hello"}, out_dir=tmp_path)

    assert out.exists()
    assert out.read_text(encoding="utf-8") == "<p>hello</p>"
```

- [ ] **Step 2: Run test**

```bash
/opt/homebrew/bin/pytest -q ads/test_render.py::test_jinja_render_produces_html_file
```

Expected: FAIL — `render_template_to_html` does not exist.

- [ ] **Step 3: Implement in `ads/render.py`**

Replace the file with:

```python
"""
Render Meta Ads creatives (1080x1080) from templates/*.html.j2 -> renders/*.png.

Flow:
  1. Load config/ads.yaml (copy + metadata per ad).
  2. For each .j2 template, render Jinja2 -> ads/.rendered/NN-slug.html.
  3. Playwright screenshots the rendered HTML at 1080x1080.

Uses scripts.pipeline for deterministic font loading (document.fonts.ready).
Legacy exports (to_file_url, SIZE, TEMPLATES_DIR, RENDERS_DIR) kept for
test back-compat.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader, StrictUndefined

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.pipeline import RenderJob, run_jobs, to_file_url as _to_file_url  # noqa: E402

ADS_DIR = Path(__file__).parent
TEMPLATES_DIR = ADS_DIR / "templates"
RENDERS_DIR = ADS_DIR / "renders"
RENDERED_HTML_DIR = ADS_DIR / ".rendered"
CONFIG_PATH = ADS_DIR.parent / "config" / "ads.yaml"
SIZE = 1080


def to_file_url(path: Path) -> str:
    """Re-export for test_render.py backward compat."""
    return _to_file_url(path)


def _jinja_env() -> Environment:
    # StrictUndefined: any missing copy.* key fails loud instead of silently
    # rendering empty — aligns with CLAUDE.md §2.7 (errors are maps).
    return Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        undefined=StrictUndefined,
        keep_trailing_newline=True,
    )


def render_template_to_html(
    template_path: Path, copy: dict, out_dir: Path | None = None
) -> Path:
    """Render a .j2 template with copy={...} and write to out_dir/<stem>.html.

    out_dir defaults to ADS_DIR/.rendered/. Assets resolved via ../assets/
    (same grandparent as templates/ and .rendered/).
    """
    out_dir = out_dir or RENDERED_HTML_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    env = Environment(
        loader=FileSystemLoader(str(template_path.parent)),
        undefined=StrictUndefined,
        keep_trailing_newline=True,
    )
    template = env.get_template(template_path.name)
    html = template.render(copy=copy)

    # .html.j2 -> .html  |  .j2 -> (strip suffix)
    stem = template_path.name.removesuffix(".j2").removesuffix(".html") + ".html"
    if stem.endswith(".html.html"):
        stem = stem[:-5]
    out = out_dir / stem
    out.write_text(html, encoding="utf-8")
    return out


def _load_config() -> dict:
    return yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))


def build_jobs() -> list[RenderJob]:
    """Build RenderJob list from config + .j2 templates.

    Each ad entry in config/ads.yaml has an id ('01'..'06'). The template
    whose filename starts with that id is rendered with the entry's copy.
    """
    RENDERS_DIR.mkdir(exist_ok=True)
    config = _load_config()
    jobs: list[RenderJob] = []
    for ad_key, ad in config["ads"].items():
        tpl_matches = list(TEMPLATES_DIR.glob(f"{ad['id']}-*.html.j2"))
        if not tpl_matches:
            raise FileNotFoundError(
                f"No template matching {ad['id']}-*.html.j2 for ad '{ad_key}'"
            )
        if len(tpl_matches) > 1:
            raise RuntimeError(
                f"Multiple templates for ad '{ad_key}': {tpl_matches}"
            )
        rendered = render_template_to_html(tpl_matches[0], ad["copy"])
        jobs.append(
            RenderJob(
                source=rendered,
                out=RENDERS_DIR / f"{rendered.stem}.png",
                width=SIZE,
                height=SIZE,
            )
        )
    return jobs


async def main():
    jobs = build_jobs()
    if not jobs:
        print(f"No ads in {CONFIG_PATH}")
        return
    print(f"Rendering {len(jobs)} ad creative(s) via Jinja2 + Playwright...")
    await run_jobs(jobs)
    for job in jobs:
        print(f"  [OK] {job.out.name}")
    print(f"\nDone: {RENDERS_DIR.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 4: Update `.gitignore`**

Append:
```
ads/.rendered/
```

- [ ] **Step 5: Run the Jinja unit test**

```bash
/opt/homebrew/bin/pytest -q ads/test_render.py::test_jinja_render_produces_html_file
```

Expected: PASS.

- [ ] **Step 6: Run full test suite — expect failures only on tests that glob `*.html`**

```bash
/opt/homebrew/bin/pytest -q
```

Expected: failures in `test_every_template_has_a_render`, `test_templates_directory_populated` (still expect `.html`), `test_tokens_truth.py` parametrized tests over ads, `test_copy_parity.py`, because we haven't migrated templates yet. These failures become the RED for Task 4.

- [ ] **Step 7: Commit**

```bash
git add ads/render.py .gitignore ads/test_render.py
git commit -m "feat(render): Jinja2 step reads config/ads.yaml before Playwright"
```

---

## Task 4 — Migrate template 01 to `.html.j2` + verify golden

Proof of concept. One template migrated, tests adjusted, visual regression green. If this works, Task 5 bulk-migrates the rest mechanically.

**Files:**
- Create: `ads/templates/01-portfolio-grid.html.j2`
- Delete: `ads/templates/01-portfolio-grid.html`
- Modify: `tests/test_tokens_truth.py`
- Modify: `tests/test_copy_parity.py`
- Modify: `ads/test_render.py`

- [ ] **Step 1: Copy `01-portfolio-grid.html` to `01-portfolio-grid.html.j2`**

```bash
cp ads/templates/01-portfolio-grid.html ads/templates/01-portfolio-grid.html.j2
```

- [ ] **Step 2: Edit the `.j2` — replace hardcoded copy strings with `{{ copy.* }}`**

In `ads/templates/01-portfolio-grid.html.j2`, change the `<body>` section from:

```html
<div class="headline">
  <h1>I built <span class="count">6 sites</span> last month.</h1>
</div>
...
<div class="bottom">
  <p class="sub">Yours could be <strong>next.</strong></p>
  <span class="cta">From €450 · Done in 7 days</span>
</div>
```

to:

```html
<div class="headline">
  <h1>{{ copy.headline_lead }} <span class="count">{{ copy.headline_count }}</span> {{ copy.headline_tail }}</h1>
</div>
...
<div class="bottom">
  <p class="sub">{{ copy.sub_lead }} <strong>{{ copy.sub_highlight }}</strong></p>
  <span class="cta">{{ copy.cta }}</span>
</div>
```

Nothing else changes — CSS, `<link>` tags, `.grid` structure, corner divs all stay byte-identical.

- [ ] **Step 3: Update test globs from `.html` to `.html.j2`**

`tests/test_tokens_truth.py:20`:
```python
AD_TEMPLATES = sorted((ROOT / "ads" / "templates").glob("*.html.j2"))
```

`tests/test_copy_parity.py` — in `_template_for`:
```python
matches = sorted(TEMPLATES_DIR.glob(f"{ad_num}-*.html.j2"))
```

And `test_every_template_is_referenced_by_copy_md`:
```python
tpl_nums = {p.name[:2] for p in TEMPLATES_DIR.glob("[0-9][0-9]-*.html.j2")}
```

`ads/test_render.py` — `test_templates_directory_populated` and `test_every_template_has_a_render`:
```python
templates = list(TEMPLATES_DIR.glob("*.html.j2"))
...
template_stems = {p.stem.removesuffix(".html") for p in TEMPLATES_DIR.glob("*.html.j2")}
```

(`.html.j2` stems via `Path.stem` give `"01-portfolio-grid.html"`. The `.removesuffix(".html")` gives `"01-portfolio-grid"` to match render stems.)

- [ ] **Step 4: Delete `ads/templates/01-portfolio-grid.html`**

```bash
rm ads/templates/01-portfolio-grid.html
```

- [ ] **Step 5: Re-render**

```bash
python3 ads/render.py
```

Expected: `ads/.rendered/01-portfolio-grid.html` created, `ads/renders/01-portfolio-grid.png` regenerated.

- [ ] **Step 6: Run visual regression**

```bash
/opt/homebrew/bin/pytest -q tests/test_visual_regression.py
```

Expected: 12 passed. The Ad 01 golden must still match — if Jinja2 introduced whitespace drift, diagnose before proceeding. Whitespace-only diffs are tolerable within the `ALLOWED_DIFF_FRACTION = 0.01`; layout drift is not.

- [ ] **Step 7: Run full test suite**

```bash
/opt/homebrew/bin/pytest -q
```

Expected: all passed (only Ad 01 migrated; other 5 still `.html`. Mixed state is OK mid-task because `tokens_truth` and `copy_parity` globs now look for `.html.j2` — Ads 02-06 become invisible until Task 5. **This is intentional**: Task 4 is proof-of-concept for one template; Task 5 finishes the migration.)

Note: `ads/test_render.py::test_every_template_has_a_render` may fail because only 1 `.j2` exists but 6 `.png` renders exist. Adjust the assertion in that task or accept a temporary skip; the cleaner fix is to finish Task 5 immediately after.

- [ ] **Step 8: Commit**

```bash
git add ads/templates/01-portfolio-grid.html.j2 \
        tests/test_tokens_truth.py tests/test_copy_parity.py ads/test_render.py
git rm ads/templates/01-portfolio-grid.html
git commit -m "refactor(ads): migrate Ad 01 to Jinja2 (.html.j2 + copy from config)"
```

---

## Task 5 — Migrate templates 02–06

Mechanically apply the same pattern to the remaining 5 templates.

**Files:**
- Create: `ads/templates/02-before-after.html.j2` … `06-niche-designers.html.j2`
- Delete: `ads/templates/02-before-after.html` … `06-niche-designers.html`

- [ ] **Step 1: For each of Ads 02-06, copy `.html` to `.html.j2`**

```bash
for n in 02-before-after 03-social-proof 04-price-objection 05-mockup-showcase 06-niche-designers; do
  cp "ads/templates/${n}.html" "ads/templates/${n}.html.j2"
done
```

- [ ] **Step 2: In each `.j2`, replace hardcoded copy with `{{ copy.* }}` per the field map in Task 2 Step 3**

For `02-before-after.html.j2`, replace the `<body>` copy strings:

```html
<h1>You're losing clients <em>right now.</em></h1>
```
becomes:
```html
<h1>{{ copy.hook_lead }} <em>{{ copy.hook_em }}</em></h1>
```

And inside `.frame-before`:
```html
<span class="empty-text">No website yet.</span>
<span class="empty-sub">Losing clients daily.</span>
```
becomes:
```html
<span class="empty-text">{{ copy.before_text }}</span>
<span class="empty-sub">{{ copy.before_sub }}</span>
```

And the `.stats-row`:
```html
<div class="stat-val accent">€500</div>
<div class="stat-lbl">Total cost</div>
...
<div class="stat-val">5 days</div>
<div class="stat-lbl">To launch</div>
...
<div class="stat-val">3×</div>
<div class="stat-lbl">More inquiries</div>
...
<div class="bottom-cta">Your turn. Message me →</div>
```
becomes:
```html
<div class="stat-val accent">{{ copy.stat1_val }}</div>
<div class="stat-lbl">{{ copy.stat1_lbl }}</div>
...
<div class="stat-val">{{ copy.stat2_val }}</div>
<div class="stat-lbl">{{ copy.stat2_lbl }}</div>
...
<div class="stat-val">{{ copy.stat3_val }}</div>
<div class="stat-lbl">{{ copy.stat3_lbl }}</div>
...
<div class="bottom-cta">{{ copy.cta }}</div>
```

For `03-social-proof.html.j2`, the testimonial block:
```html
Built a portfolio site<br>
for <span class="name">a designer<br>
in Berlin.</span>
```
becomes:
```html
{{ copy.testimonial_lead }}<br>
for <span class="name">{{ copy.testimonial_highlight_line1 }}<br>
{{ copy.testimonial_highlight_line2 }}</span>
```

Stats (same pattern as 02), plus `.subtext`:
```html
<div class="subtext">"Best investment I made this year."</div>
```
becomes:
```html
<div class="subtext">{{ copy.subtext }}</div>
```

For `04-price-objection.html.j2`:
```html
<div class="line1">They quoted you</div>
<div class="price-old">€3,000</div>
<div class="line2">I charge</div>
<div class="price-new">€450.</div>
<div class="turnaround">Done in 7 days.</div>
<div class="cta">Stop overthinking. <strong>Message me.</strong></div>
```
becomes:
```html
<div class="line1">{{ copy.line1 }}</div>
<div class="price-old">{{ copy.price_old }}</div>
<div class="line2">{{ copy.line2 }}</div>
<div class="price-new">{{ copy.price_new }}</div>
<div class="turnaround">{{ copy.turnaround }}</div>
<div class="cta">{{ copy.cta_lead }} <strong>{{ copy.cta_strong }}</strong></div>
```

For `05-mockup-showcase.html.j2`:
```html
<div class="badge">Custom Web Development</div>
<h1 class="headline">
  Still sending clients<br>
  to your <em>Instagram bio?</em>
</h1>
...
<div class="bottom-item"><span class="icon">&#10003;</span> From €450</div>
<div class="bottom-item"><span class="icon">&#10003;</span> Ready in 7 days</div>
<div class="bottom-item"><span class="icon">&#10003;</span> 50+ delivered</div>
<div class="bottom-cta">Message me to get started →</div>
```
becomes:
```html
<div class="badge">{{ copy.badge }}</div>
<h1 class="headline">
  {{ copy.headline_lead }}<br>
  to your <em>{{ copy.headline_em }}</em>
</h1>
...
<div class="bottom-item"><span class="icon">&#10003;</span> {{ copy.bottom_item1 }}</div>
<div class="bottom-item"><span class="icon">&#10003;</span> {{ copy.bottom_item2 }}</div>
<div class="bottom-item"><span class="icon">&#10003;</span> {{ copy.bottom_item3 }}</div>
<div class="bottom-cta">{{ copy.bottom_cta }}</div>
```

For `06-niche-designers.html.j2`:
```html
<div class="niche-tag">Websites for Designers</div>
...
<h1>
  No portfolio site?<br>
  You're <em>invisible.</em>
</h1>
<p class="sub">Your competitors have one. You should too.</p>
...
<span class="cta-price">From €450</span>
<div class="cta-sep"></div>
<span class="cta-days">Ready in 7 days</span>
<div class="cta-sep"></div>
<span class="cta-action">Message me</span>
```
becomes:
```html
<div class="niche-tag">{{ copy.niche_tag }}</div>
...
<h1>
  {{ copy.headline_lead }}<br>
  You're <em>{{ copy.headline_em }}</em>
</h1>
<p class="sub">{{ copy.sub }}</p>
...
<span class="cta-price">{{ copy.cta_price }}</span>
<div class="cta-sep"></div>
<span class="cta-days">{{ copy.cta_days }}</span>
<div class="cta-sep"></div>
<span class="cta-action">{{ copy.cta_action }}</span>
```

- [ ] **Step 3: Re-render all ads**

```bash
python3 ads/render.py
```

Expected: 6 PNGs regenerated in `ads/renders/`, 6 intermediates in `ads/.rendered/`.

- [ ] **Step 4: Run visual regression**

```bash
/opt/homebrew/bin/pytest -q tests/test_visual_regression.py
```

Expected: 12 passed, zero drift beyond 1%. If any ad diffs beyond threshold, inspect `ads/.rendered/<slug>.html` vs the original `.html` (kept in git history) and find the whitespace/text mismatch.

- [ ] **Step 5: Delete the 5 legacy `.html` templates**

```bash
rm ads/templates/02-before-after.html \
   ads/templates/03-social-proof.html \
   ads/templates/04-price-objection.html \
   ads/templates/05-mockup-showcase.html \
   ads/templates/06-niche-designers.html
```

- [ ] **Step 6: Run full test suite**

```bash
/opt/homebrew/bin/pytest -q
```

Expected: all 173 passed. `tokens_truth` parametrizes over 11 HTMLs (5 brand `.html` + 6 ads `.html.j2`); `copy_parity` has 20 cases; visual regression 12; integration 15.

- [ ] **Step 7: Commit**

```bash
git add ads/templates/*.html.j2
git rm ads/templates/02-before-after.html ads/templates/03-social-proof.html \
       ads/templates/04-price-objection.html ads/templates/05-mockup-showcase.html \
       ads/templates/06-niche-designers.html
git commit -m "refactor(ads): migrate ads 02-06 to Jinja2 (.html.j2 + config)"
```

---

## Task 6 — `features/copy_generation/` skeleton + schema

**Files:**
- Create: `features/__init__.py`, `features/copy_generation/__init__.py`
- Create: `features/copy_generation/schema.py`
- Create: `features/copy_generation/test_schema.py`

- [ ] **Step 1: Create package roots**

```bash
mkdir -p features/copy_generation
touch features/__init__.py features/copy_generation/__init__.py
```

- [ ] **Step 2: Write the failing test** (`features/copy_generation/test_schema.py`)

```python
from features.copy_generation.schema import Brief, CopyVariant, AgentResult


def test_brief_has_required_fields():
    b = Brief(
        product="Custom sites",
        audience="Freelancers",
        pain="No site = no clients",
        social_proof="6 sites last month",
        cta="Message me",
    )
    assert b.product == "Custom sites"
    assert b.social_proof == "6 sites last month"


def test_brief_social_proof_optional():
    b = Brief(product="x", audience="y", pain="z", social_proof=None, cta="q")
    assert b.social_proof is None


def test_copy_variant_confidence_symbol():
    v = CopyVariant(
        headline="H", primary_text="P", description="D", confidence="high"
    )
    assert v.confidence_symbol == "✅"

    v2 = CopyVariant(headline="H", primary_text="P", description="D", confidence="medium")
    assert v2.confidence_symbol == "⚠️"

    v3 = CopyVariant(headline="H", primary_text="P", description="D", confidence="low")
    assert v3.confidence_symbol == "🔴"


def test_agent_result_variants_list():
    v = CopyVariant(headline="H", primary_text="P", description="D", confidence="high")
    r = AgentResult(variants=[v, v, v], trace="reasoning…", methodology="pas",
                    model="claude-sonnet-4-6")
    assert len(r.variants) == 3
    assert r.methodology == "pas"
```

- [ ] **Step 3: Run test**

```bash
/opt/homebrew/bin/pytest -q features/copy_generation/test_schema.py
```

Expected: FAIL — `schema.py` missing.

- [ ] **Step 4: Implement `features/copy_generation/schema.py`**

```python
"""Input/output contract for the copy generation agent.

Designed for progressive disclosure: readers see the shape before diving
into agent internals.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

Confidence = Literal["high", "medium", "low"]

_CONF_SYMBOL = {"high": "✅", "medium": "⚠️", "low": "🔴"}


@dataclass
class Brief:
    """What the agent receives. Maps 1:1 to config/ads.yaml .brief section."""
    product: str
    audience: str
    pain: str
    cta: str
    social_proof: str | None = None


@dataclass
class CopyVariant:
    """One A/B variant. headline/primary_text/description correspond to
    the Meta Ads Manager fields, not to the visual copy inside the PNG."""
    headline: str
    primary_text: str
    description: str
    confidence: Confidence

    @property
    def confidence_symbol(self) -> str:
        return _CONF_SYMBOL[self.confidence]


@dataclass
class AgentResult:
    """Output of `agent.generate()`. `trace` is the chain-of-thought the
    reviewer sees in the GUI or logs — more valuable than the output alone."""
    variants: list[CopyVariant]
    trace: str
    methodology: str
    model: str
```

- [ ] **Step 5: Run test**

```bash
/opt/homebrew/bin/pytest -q features/copy_generation/test_schema.py
```

Expected: PASS (4 passed).

- [ ] **Step 6: Commit**

```bash
git add features/__init__.py features/copy_generation/__init__.py \
        features/copy_generation/schema.py features/copy_generation/test_schema.py
git commit -m "feat(copy_generation): schema for Brief/CopyVariant/AgentResult"
```

---

## Task 7 — Methodologies (base + PAS + NPQEL stub)

**Files:**
- Create: `features/copy_generation/methodologies/__init__.py`
- Create: `features/copy_generation/methodologies/base.py`
- Create: `features/copy_generation/methodologies/pas.py`
- Create: `features/copy_generation/methodologies/npqel.py`
- Create: `features/copy_generation/prompts/system.md`
- Create: `features/copy_generation/prompts/pas.md`
- Create: `features/copy_generation/prompts/npqel.md`
- Create: `features/copy_generation/test_methodologies.py`

- [ ] **Step 1: Write the failing test**

`features/copy_generation/test_methodologies.py`:

```python
import pytest
from features.copy_generation.schema import Brief
from features.copy_generation.methodologies import by_name
from features.copy_generation.methodologies.pas import PAS
from features.copy_generation.methodologies.npqel import NPQEL


@pytest.fixture
def brief() -> Brief:
    return Brief(
        product="Custom websites from €450 in 7 days",
        audience="European freelancers",
        pain="Losing clients to competitors with real sites",
        social_proof="6 sites last month",
        cta="Message me",
    )


def test_pas_name_and_description():
    assert PAS.name == "pas"
    assert "Problem" in PAS.description
    assert "Solution" in PAS.description


def test_pas_builds_user_prompt_with_brief_fields(brief):
    prompt = PAS.build_user_prompt(brief, n=3)
    assert "3" in prompt
    assert brief.product in prompt
    assert brief.audience in prompt
    assert brief.pain in prompt
    assert brief.cta in prompt
    assert brief.social_proof in prompt


def test_npqel_is_placeholder(brief):
    assert NPQEL.name == "npqel"
    with pytest.raises(NotImplementedError, match="NPQEL"):
        NPQEL.build_user_prompt(brief, n=3)


def test_registry_resolves_known_names():
    assert by_name("pas") is PAS
    assert by_name("npqel") is NPQEL


def test_registry_unknown_raises():
    with pytest.raises(KeyError, match="unknown methodology"):
        by_name("nonexistent")
```

- [ ] **Step 2: Run test**

```bash
/opt/homebrew/bin/pytest -q features/copy_generation/test_methodologies.py
```

Expected: FAIL — imports missing.

- [ ] **Step 3: Implement `methodologies/base.py`**

```python
"""Methodology contract. Every framework (PAS, NPQEL, …) implements this Protocol."""
from __future__ import annotations

from pathlib import Path
from typing import Protocol

from features.copy_generation.schema import Brief


class Methodology(Protocol):
    name: str
    description: str
    system_prompt_path: Path

    def build_user_prompt(self, brief: Brief, n: int) -> str: ...
```

- [ ] **Step 4: Implement `methodologies/pas.py`**

```python
"""PAS — Problem, Agitate, Solution. Direct-response copywriting framework."""
from __future__ import annotations

from pathlib import Path

from features.copy_generation.schema import Brief

_PROMPTS = Path(__file__).parent.parent / "prompts"


class _PAS:
    name = "pas"
    description = (
        "Problem-Agitate-Solution: surface the pain, amplify its cost, "
        "then present the offer as resolution."
    )
    system_prompt_path = _PROMPTS / "system.md"
    user_prompt_template_path = _PROMPTS / "pas.md"

    def build_user_prompt(self, brief: Brief, n: int) -> str:
        template = self.user_prompt_template_path.read_text(encoding="utf-8")
        return template.format(
            n=n,
            product=brief.product,
            audience=brief.audience,
            pain=brief.pain,
            social_proof=brief.social_proof or "(none)",
            cta=brief.cta,
        )


PAS = _PAS()
```

- [ ] **Step 5: Implement `methodologies/npqel.py`**

```python
"""NPQEL — placeholder. Framework not yet defined by the user.

When NPQEL is specified:
  1. Fill prompts/npqel.md with the framework template.
  2. Implement build_user_prompt() analogous to PAS.
  3. Remove the NotImplementedError.
"""
from __future__ import annotations

from pathlib import Path

from features.copy_generation.schema import Brief

_PROMPTS = Path(__file__).parent.parent / "prompts"


class _NPQEL:
    name = "npqel"
    description = "NPQEL — framework pending user definition."
    system_prompt_path = _PROMPTS / "system.md"
    user_prompt_template_path = _PROMPTS / "npqel.md"

    def build_user_prompt(self, brief: Brief, n: int) -> str:
        raise NotImplementedError(
            "NPQEL framework not defined — fill prompts/npqel.md with the "
            "framework template and implement build_user_prompt() in "
            "features/copy_generation/methodologies/npqel.py"
        )


NPQEL = _NPQEL()
```

- [ ] **Step 6: Implement `methodologies/__init__.py` registry**

```python
"""Registry — by_name() is the public entry-point."""
from __future__ import annotations

from features.copy_generation.methodologies.base import Methodology
from features.copy_generation.methodologies.pas import PAS
from features.copy_generation.methodologies.npqel import NPQEL

_REGISTRY: dict[str, Methodology] = {
    "pas": PAS,
    "npqel": NPQEL,
}


def by_name(name: str) -> Methodology:
    if name not in _REGISTRY:
        known = ", ".join(sorted(_REGISTRY.keys()))
        raise KeyError(f"unknown methodology '{name}' — known: {known}")
    return _REGISTRY[name]
```

- [ ] **Step 7: Implement `prompts/system.md`**

```markdown
You are a senior direct-response copywriter working for Vibe Web, a European
web agency targeting freelancers without a website.

Your output is three-field ad copy for Meta Ads Manager:
- HEADLINE (max 40 characters)
- PRIMARY TEXT (max 600 characters, may include line breaks)
- DESCRIPTION (max 30 characters)

You must also rate each variant's alignment to the methodology:
- high   — the structure is clean, the pain is sharp, the offer is unambiguous
- medium — acceptable but one element is weak
- low    — the methodology is barely visible; do not ship without a rewrite

Respond ONLY as a JSON array of objects with keys:
  {"headline": str, "primary_text": str, "description": str, "confidence": "high"|"medium"|"low", "reasoning": str}

No prose before or after the JSON.
```

- [ ] **Step 8: Implement `prompts/pas.md`**

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
  cta:           {cta}

Generate {n} distinct PAS variants. Vary the hook and the angle — not just word choice.
```

- [ ] **Step 9: Implement `prompts/npqel.md`**

```markdown
<!-- NPQEL framework — not yet defined. Fill this file when the user specifies the framework. -->
```

- [ ] **Step 10: Run test**

```bash
/opt/homebrew/bin/pytest -q features/copy_generation/test_methodologies.py
```

Expected: 5 passed.

- [ ] **Step 11: Commit**

```bash
git add features/copy_generation/methodologies/ features/copy_generation/prompts/ \
        features/copy_generation/test_methodologies.py
git commit -m "feat(copy_generation): PAS methodology live, NPQEL stubbed"
```

---

## Task 8 — Agent (Claude API + dry-run mode)

**Files:**
- Create: `features/copy_generation/agent.py`
- Create: `features/copy_generation/test_agent.py`

- [ ] **Step 1: Write the failing test**

`features/copy_generation/test_agent.py`:

```python
import json
import os

import pytest

from features.copy_generation.agent import generate, DEFAULT_MODEL
from features.copy_generation.schema import AgentResult, Brief


@pytest.fixture
def brief() -> Brief:
    return Brief(
        product="Custom websites from €450 in 7 days",
        audience="European freelancers",
        pain="Losing clients to competitors with real sites",
        social_proof="6 sites last month",
        cta="Message me",
    )


def test_default_model_is_sonnet_4_6():
    assert DEFAULT_MODEL == "claude-sonnet-4-6"


def test_dry_run_returns_n_variants(brief, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    result = generate(brief, methodology="pas", n=3)
    assert isinstance(result, AgentResult)
    assert len(result.variants) == 3
    assert result.methodology == "pas"
    assert result.model == "dry-run"


def test_dry_run_is_deterministic(brief, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    a = generate(brief, methodology="pas", n=3)
    b = generate(brief, methodology="pas", n=3)
    assert [v.headline for v in a.variants] == [v.headline for v in b.variants]


def test_dry_run_when_no_api_key(brief, monkeypatch):
    """Missing ANTHROPIC_API_KEY alone triggers dry-run, no VIBEWEB_DRY_RUN needed."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)
    result = generate(brief, methodology="pas", n=2)
    assert result.model == "dry-run"
    assert len(result.variants) == 2


def test_unknown_methodology_raises(brief, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    with pytest.raises(KeyError, match="unknown methodology"):
        generate(brief, methodology="ghost", n=3)


def test_npqel_dry_run_still_raises(brief, monkeypatch):
    """Dry-run doesn't bypass the NotImplementedError — NPQEL is a real stub."""
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    with pytest.raises(NotImplementedError, match="NPQEL"):
        generate(brief, methodology="npqel", n=3)


@pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY") or os.getenv("VIBEWEB_DRY_RUN") == "1",
    reason="requires real ANTHROPIC_API_KEY and VIBEWEB_DRY_RUN unset",
)
def test_real_api_call(brief):
    result = generate(brief, methodology="pas", n=3)
    assert result.model == DEFAULT_MODEL
    assert len(result.variants) == 3
    for v in result.variants:
        assert v.headline
        assert v.primary_text
        assert v.confidence in {"high", "medium", "low"}
```

- [ ] **Step 2: Run test**

```bash
/opt/homebrew/bin/pytest -q features/copy_generation/test_agent.py
```

Expected: FAIL — `agent.py` missing.

- [ ] **Step 3: Implement `features/copy_generation/agent.py`**

```python
"""Copy generation agent — Claude API wrapper with dry-run mode.

Modes (resolved by environment):
  - dry-run: VIBEWEB_DRY_RUN=1  OR  ANTHROPIC_API_KEY unset
  - real:    ANTHROPIC_API_KEY set AND VIBEWEB_DRY_RUN unset (or != 1)

Dry-run returns deterministic stub variants so tests and local dev cost zero
tokens. Real mode posts one messages.create() call; no streaming, no retry
loop — failures raise verbose to make their cause obvious.
"""
from __future__ import annotations

import json
import os

from features.copy_generation.methodologies import by_name
from features.copy_generation.schema import AgentResult, Brief, CopyVariant

DEFAULT_MODEL = "claude-sonnet-4-6"
DRY_RUN_MODEL_TAG = "dry-run"


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
    methodology, brief: Brief, n: int, model: str
) -> AgentResult:
    # Import lazily so dry-run tests don't need the anthropic package installed.
    from anthropic import Anthropic

    client = Anthropic()
    system = methodology.system_prompt_path.read_text(encoding="utf-8")
    user = methodology.build_user_prompt(brief, n=n)

    response = client.messages.create(
        model=model,
        max_tokens=2048,
        system=system,
        messages=[{"role": "user", "content": user}],
    )

    if not response.content or not hasattr(response.content[0], "text"):
        raise RuntimeError(
            f"Unexpected Claude response shape: {response!r}"
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

    variants = [
        CopyVariant(
            headline=v["headline"],
            primary_text=v["primary_text"],
            description=v["description"],
            confidence=v["confidence"],
        )
        for v in payload
    ]
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
    m.build_user_prompt(brief, n=n)

    if _is_dry_run():
        return _dry_run_variants(brief, methodology_name=methodology, n=n)
    return _call_claude(m, brief, n=n, model=model)
```

- [ ] **Step 4: Run test**

```bash
/opt/homebrew/bin/pytest -q features/copy_generation/test_agent.py
```

Expected: 6 passed, 1 skipped (real API test).

- [ ] **Step 5: Commit**

```bash
git add features/copy_generation/agent.py features/copy_generation/test_agent.py
git commit -m "feat(copy_generation): Claude API agent with dry-run mode"
```

---

## Task 9 — Feature CLAUDE.md

**Files:**
- Create: `features/copy_generation/CLAUDE.md`

- [ ] **Step 1: Create `features/copy_generation/CLAUDE.md`**

```markdown
# features/copy_generation — agent context

Inherits from the root `CLAUDE.md`. This file adds feature-specific rules.

## What this does

Generates N copy variants (`CopyVariant`) for a `Brief` using a pluggable
`Methodology` (PAS live; NPQEL stubbed). Output is an `AgentResult` carrying
variants + chain-of-thought trace + methodology tag + model used.

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
```

- [ ] **Step 2: Commit**

```bash
git add features/copy_generation/CLAUDE.md
git commit -m "docs(copy_generation): feature CLAUDE.md"
```

---

## Task 10 — Final verification

- [ ] **Step 1: Install clean**

```bash
pip3 install -e ".[dev]"
```

- [ ] **Step 2: Regenerate all assets**

```bash
python3 scripts/build.py --all
```

Expected: 21 PNGs regenerated. Brand pack unchanged (still uses `.html`); ads now flow through Jinja2 + config.

- [ ] **Step 3: Run full test suite**

```bash
/opt/homebrew/bin/pytest -q
```

Expected target: ≥195 passed (baseline 171 + deps 2 + config ~10 + schema 4 + methodologies 5 + agent 6 + Jinja unit 1 = ~199). Zero failures. Real-API test skipped.

- [ ] **Step 4: Run visual regression explicitly**

```bash
/opt/homebrew/bin/pytest -q tests/test_visual_regression.py
```

Expected: 12 passed — the Jinja2 migration produced byte-identical renders within the 1% threshold.

- [ ] **Step 5: Wheel-install smoke test (ensures `features*` ships)**

```bash
python3 -m build 2>/dev/null || pip3 install build && python3 -m build
pip3 install dist/vibeweb-*.whl --force-reinstall --target /tmp/vibeweb-wheel-check
python3 -c "import sys; sys.path.insert(0, '/tmp/vibeweb-wheel-check'); \
  from features.copy_generation.agent import generate; \
  from features.copy_generation.schema import Brief; \
  print('wheel-import OK')"
rm -rf /tmp/vibeweb-wheel-check dist build *.egg-info
```

Expected: `wheel-import OK`.

- [ ] **Step 6: Review Gate**

Invoke `pr-review-toolkit:review-pr` against the full Spec 1 diff (from baseline commit before Task 1 through last commit). Fix anything flagged as blocking before proceeding.

---

## Self-review checklist

Run before handing off to the executor.

- **Spec coverage:** every section of `docs/superpowers/specs/2026-04-17-ai-creative-factory-design.md` §3-10 maps to a task above. §11 (out-of-scope) items are not implemented.
- **Placeholder scan:** every code block is literal (no "TBD", "TODO", no "similar to Task N"). Every field name used in Tasks 5-8 (e.g. `copy.headline_lead`, `confidence`, `AgentResult.model`) matches its definition.
- **Type consistency:** `Brief`, `CopyVariant`, `AgentResult`, `Methodology`, `DEFAULT_MODEL`, `by_name` are used with matching signatures across tests and implementations.
- **Gitignore:** `ads/.rendered/` added.
- **Deletion of legacy `.html`** only happens after corresponding `.j2` is verified against golden.

---

## Execution notes

Run tasks sequentially — **no parallelism**. Tasks 3-5 share `ads/render.py` and the template directory; Tasks 6-8 build on each other's imports. A fresh subagent per task is safe; inline execution is faster and probably fine given the small surface area.

After Task 10 Step 6 (review gate) passes clean → declare DONE and transition state to COMPLETED.
