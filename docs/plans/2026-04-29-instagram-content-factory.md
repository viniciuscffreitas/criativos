# Instagram Content Factory v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap a conversion-focused English Instagram account for Vibe Web by producing 9 grid posts (6 singles + 3 carousels = 27 PNG renders at 1080×1350) using the existing Playwright pipeline, plus the bio text and CLI integration.

**Architecture:** New vertical slice at `features/instagram_content/` that consumes `scripts/pipeline.py` (deterministic Playwright + `document.fonts.ready`) without modifying it. Templates are HTML+CSS using `brand/tokens.css` as single source of truth. Carousels are parameterized via `?slide=N` query string (mirrors existing `instagram-highlight.html?type=...`). Tests run in four layers: structural (PNG dimensions), tokens-truth (extends existing test), visual regression (extends existing pattern), and a new safe-zone check (static CSS lint + runtime band scan of rendered PNG).

**Tech Stack:** Python 3.11+ (existing), Playwright async, Pillow (existing), pytest (existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-29-instagram-content-factory-design.md` (commit `84b9ad2`).

---

## Pre-flight checks (do these once before Task 1)

- [ ] Confirm spec exists: `ls docs/superpowers/specs/2026-04-29-instagram-content-factory-design.md`
- [ ] Confirm working tree clean: `git status` — should be `nothing to commit, working tree clean`
- [ ] Confirm baseline tests pass: `pytest -q` — should be all green (currently 141 tests)
- [ ] Confirm asset dependencies exist: `ls ads/assets/site-{onearc,alytics,lunera,messageai,dreelio}.png ads/assets/guima-dark.png` — all 6 files present

If any check fails: **stop and surface to human** before proceeding. The plan assumes a clean baseline.

---

## File Structure (locked before tasks begin)

```
features/instagram_content/        NEW — vertical slice
  __init__.py                      empty marker
  CLAUDE.md                        feature-specific context (publish runbook)
  bio.md                           bio text (copy-paste source for IG)
  jobs.py                          declarative 27-job list
  render.py                        async entry-point
  test_render.py                   structural + visual + safe-zone tests
  templates/
    single-manifesto.html
    single-cost-of-inaction.html
    single-niche-tag.html
    single-proof-number.html
    single-offer-mechanics.html
    single-cta-pure.html
    carousel-portfolio.html        ?slide=1..7
    carousel-services.html         ?slide=1..7
    carousel-process.html          ?slide=1..7
  goldens/
    *.png                          27 PNGs — committed after Task 11
  renders/                         gitignored — output of build.py --instagram

brand/tokens.css                   MODIFY — add --ig-handle token
scripts/build.py                   MODIFY — add --instagram flag
tests/test_tokens_truth.py         MODIFY — add INSTAGRAM_TEMPLATES glob
.gitignore                         MODIFY — ignore features/instagram_content/renders/
```

---

## Task 1: Add `--ig-handle` token + feature scaffolding

**Why first:** Establishes the token that templates will consume. Pure additive change — won't break existing tests.

**Files:**
- Modify: `brand/tokens.css` (add one line)
- Create: `features/instagram_content/__init__.py` (empty)
- Create: `features/instagram_content/CLAUDE.md`
- Create: `features/instagram_content/bio.md`
- Modify: `.gitignore` (add `features/instagram_content/renders/`)

- [ ] **Step 1: Write the failing test for `--ig-handle` token**

Add to `tests/test_tokens_truth.py` near `test_tokens_css_exposes_accent_rgb_channel` (around line 102):

```python
def test_tokens_css_declares_ig_handle():
    tokens = (ROOT / "brand" / "tokens.css").read_text(encoding="utf-8")
    assert re.search(r'--ig-handle\s*:\s*"@', tokens), (
        "tokens.css must declare --ig-handle as a quoted string token "
        "(used in templates as content: var(--ig-handle))"
    )
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_tokens_truth.py::test_tokens_css_declares_ig_handle -v
```

Expected: FAIL with `AssertionError: tokens.css must declare --ig-handle ...`

- [ ] **Step 3: Add the token to `brand/tokens.css`**

Insert after the `--font-mono` line (around line 51), before the closing `}`:

```css
  /* ---------- Instagram (handle as content-string token) ---------- */
  --ig-handle:    "@vibeweb.eu";
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_tokens_truth.py::test_tokens_css_declares_ig_handle -v
```

Expected: PASS.

- [ ] **Step 5: Create feature scaffolding files**

Create `features/instagram_content/__init__.py`:

```python
"""Vibe Web — Instagram content factory v1.

Spec: docs/superpowers/specs/2026-04-29-instagram-content-factory-design.md
"""
```

Create `features/instagram_content/CLAUDE.md` with this content (publish runbook):

```markdown
# Instagram Content Factory — Feature Context

Vertical slice that produces the v1 Instagram launch batch (27 PNGs at 1080×1350)
from HTML+CSS templates rendered via `scripts.pipeline`. Copy is hardcoded per
template; see the spec for the PAS-methodology rationale.

## Inputs
- `brand/tokens.css` — design tokens (colors, fonts, `--ig-handle`)
- `ads/assets/*.png` — site screenshots reused by `carousel-portfolio.html`

## Outputs
- `renders/*.png` — 27 deterministic renders (gitignored)
- `goldens/*.png` — committed regression baseline

## Non-obvious constraints
- All renders are 1080×1350 (4:5 portrait — 2026 IG default).
- Critical text must stay outside the top 60px and bottom 60px (safe-zone)
  because the 3:4 grid preview crops both bands.
- Carousels parameterize slide content via `?slide=1..7` query string.
- The `@vibeweb.eu` handle is a placeholder — change `--ig-handle` in
  `brand/tokens.css` to update everywhere.

## Publish runbook (manual, v1)
1. Run `python scripts/build.py --instagram`.
2. Inspect `features/instagram_content/renders/*.png` visually.
3. If layouts changed intentionally, copy the new PNGs into `goldens/` and commit.
4. Upload to Meta Business Suite Composer in **reverse order** (post 9 first
   → post 1 last) so newest-top-left grid order matches the spec.
5. For each carousel, upload slides 1..7 in order in a single carousel post.
6. Paste `bio.md` content into the Instagram bio (replace handle token if
   different from @vibeweb.eu).
7. Pin highlights in profile order: services → portfolio → about → contact → feed.
```

Create `features/instagram_content/bio.md`:

```markdown
# Vibe Web — Instagram bio (v1)

Custom websites · €450 · 7 days
For European freelancers + small businesses
DM 'site' to start →
@vibeweb.eu  ↓

**Link in bio:** https://vibeweb.eu/start  *(landing page is a future spec)*

Character count (excluding link): ~110 / 150 IG limit.
```

- [ ] **Step 6: Update `.gitignore`**

Append to `.gitignore`:

```gitignore

# Instagram content factory — renders are deterministic outputs;
# goldens/ is the committed regression baseline.
features/instagram_content/renders/
```

- [ ] **Step 7: Run full test suite to confirm no regression**

```bash
pytest -q
```

Expected: all green (existing 141 tests + 1 new = 142 passing).

- [ ] **Step 8: Commit**

```bash
git add brand/tokens.css features/instagram_content/__init__.py features/instagram_content/CLAUDE.md features/instagram_content/bio.md tests/test_tokens_truth.py .gitignore
git commit -m "feat(instagram): scaffold feature + --ig-handle token

Adds:
- brand/tokens.css: --ig-handle: \"@vibeweb.eu\" token
- features/instagram_content/: __init__.py, CLAUDE.md (publish runbook),
  bio.md (IG bio copy)
- tests/test_tokens_truth.py: test_tokens_css_declares_ig_handle
- .gitignore: features/instagram_content/renders/"
```

---

## Task 2: Test infrastructure + tokens-truth glob extension

**Why second:** lays the validation harness so all subsequent template authoring is checked at write-time. Initially zero templates → parametrized tests skip; as templates land they get picked up automatically.

**Files:**
- Modify: `tests/test_tokens_truth.py` (add `INSTAGRAM_TEMPLATES` glob)
- Create: `features/instagram_content/test_render.py`

- [ ] **Step 1: Extend `tests/test_tokens_truth.py` to include IG templates**

Modify the glob block (around lines 19-21):

```python
BRAND_TEMPLATES = sorted((ROOT / "brand" / "social" / "templates").glob("*.html"))
AD_TEMPLATES = sorted((ROOT / "ads" / "templates").glob("*.html"))
INSTAGRAM_TEMPLATES = sorted((ROOT / "features" / "instagram_content" / "templates").glob("*.html"))
ALL_TEMPLATES = BRAND_TEMPLATES + AD_TEMPLATES + INSTAGRAM_TEMPLATES
```

- [ ] **Step 2: Run tokens-truth tests — should still all pass (0 IG templates exist yet)**

```bash
pytest tests/test_tokens_truth.py -q
```

Expected: PASS. Parametrized tests over `ALL_TEMPLATES` are unchanged in count.

- [ ] **Step 3: Write `features/instagram_content/test_render.py` skeleton**

```python
"""
Instagram content factory — structural + visual + safe-zone tests.

Four layers:
  1. test_dimensions_match     — PNG is exactly 1080x1350.
  2. test_safe_zone_static     — CSS regex lint: no critical text in top/bottom 60px.
  3. test_safe_zone_runtime    — Pillow band scan: no non-bg pixels in top/bottom 60px.
  4. test_visual_regression    — Pillow ImageChops vs goldens/<name>.png.

Tokens-truth is enforced from tests/test_tokens_truth.py via INSTAGRAM_TEMPLATES.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest
from PIL import Image, ImageChops

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from features.instagram_content.jobs import build_jobs  # noqa: E402
from tests.test_visual_regression import (  # noqa: E402
    ALLOWED_DIFF_FRACTION,
    PIXEL_DIFF_THRESHOLD,
)

FEATURE_DIR = Path(__file__).parent
TEMPLATES_DIR = FEATURE_DIR / "templates"
RENDERS_DIR = FEATURE_DIR / "renders"
GOLDENS_DIR = FEATURE_DIR / "goldens"

# Background as RGB sum: --bg is #0a0a0a => 10+10+10 = 30.
BG_SUM = 30
BG_BAND_TOLERANCE = 30  # Manhattan distance from BG_SUM
SAFE_ZONE_PX = 60
SAFE_ZONE_FRACTION_LIMIT = 0.01  # ≤1% non-bg pixels per band

CRITICAL_SELECTORS = re.compile(
    r"\.(headline|hook|cta|cta-bar|main-text)\b|^\s*h1\b", re.MULTILINE
)
TOP_DECL = re.compile(r"top\s*:\s*(\d+)\s*px", re.IGNORECASE)
BOTTOM_DECL = re.compile(r"bottom\s*:\s*(\d+)\s*px", re.IGNORECASE)


def _all_templates() -> list[Path]:
    return sorted(TEMPLATES_DIR.glob("*.html"))


def _all_renders() -> list[tuple[Path, int, int]]:
    """(out_path, width, height) per RenderJob."""
    return [(j.out, j.width, j.height) for j in build_jobs()]


# ---------- Layer 1: dimensions ---------------------------------------------

@pytest.mark.parametrize(
    "render,width,height",
    _all_renders(),
    ids=[r[0].name for r in _all_renders()],
)
def test_dimensions_match(render, width, height):
    if not render.exists():
        pytest.skip(f"Render missing: {render.name} — run build.py --instagram")
    with Image.open(render) as im:
        assert im.size == (width, height), (
            f"{render.name}: expected {width}x{height}, got {im.size}"
        )


# ---------- Layer 2: safe-zone static lint ----------------------------------

@pytest.mark.parametrize(
    "tpl",
    _all_templates(),
    ids=lambda p: p.name,
)
def test_safe_zone_static(tpl):
    """Reject critical text positioned in top 60px or bottom 60px."""
    css = tpl.read_text(encoding="utf-8")
    # Walk each rule block; if a rule selector matches CRITICAL_SELECTORS,
    # check its top/bottom declarations.
    for block in re.finditer(
        r"([^{}]+)\{([^{}]*)\}", css, re.MULTILINE
    ):
        selector, body = block.group(1), block.group(2)
        if not CRITICAL_SELECTORS.search(selector):
            continue
        for m in TOP_DECL.finditer(body):
            assert int(m.group(1)) >= SAFE_ZONE_PX, (
                f"{tpl.name}: selector '{selector.strip()}' has top: {m.group(1)}px "
                f"— must be >= {SAFE_ZONE_PX}px (3:4 grid crop)"
            )
        for m in BOTTOM_DECL.finditer(body):
            assert int(m.group(1)) >= SAFE_ZONE_PX, (
                f"{tpl.name}: selector '{selector.strip()}' has bottom: {m.group(1)}px "
                f"— must be >= {SAFE_ZONE_PX}px (3:4 grid crop)"
            )


# ---------- Layer 3: safe-zone runtime band scan ----------------------------

@pytest.mark.parametrize(
    "render,width,height",
    _all_renders(),
    ids=[r[0].name for r in _all_renders()],
)
def test_safe_zone_runtime(render, width, height):
    """Top 60px and bottom 60px must be ≥99% background pixels."""
    if not render.exists():
        pytest.skip(f"Render missing: {render.name} — run build.py --instagram")
    with Image.open(render) as im:
        rgb = im.convert("RGB")
        total_per_band = width * SAFE_ZONE_PX
        for band_name, top, bottom in [
            ("top", 0, SAFE_ZONE_PX),
            ("bottom", height - SAFE_ZONE_PX, height),
        ]:
            band = rgb.crop((0, top, width, bottom))
            data = band.tobytes()
            non_bg = sum(
                1 for i in range(0, len(data), 3)
                if abs((data[i] + data[i + 1] + data[i + 2]) - BG_SUM)
                > BG_BAND_TOLERANCE
            )
            frac = non_bg / total_per_band
            assert frac <= SAFE_ZONE_FRACTION_LIMIT, (
                f"{render.name}: {band_name} 60px band has {frac*100:.2f}% "
                f"non-background pixels (limit {SAFE_ZONE_FRACTION_LIMIT*100:.1f}%)"
            )


# ---------- Layer 4: visual regression -------------------------------------

@pytest.mark.visual
@pytest.mark.parametrize(
    "render,width,height",
    _all_renders(),
    ids=[r[0].name for r in _all_renders()],
)
def test_visual_regression(render, width, height):
    """Per-render perceptual diff vs. goldens/<name>.png."""
    if not render.exists():
        pytest.skip(f"Render missing: {render.name}")
    golden = GOLDENS_DIR / render.name
    if not golden.exists():
        pytest.skip(f"Golden missing: {golden.name} — author with build.py --instagram")
    with Image.open(render) as cur, Image.open(golden) as gold:
        cur_rgb = cur.convert("RGB")
        gold_rgb = gold.convert("RGB")
        assert cur_rgb.size == gold_rgb.size
        data = ImageChops.difference(cur_rgb, gold_rgb).tobytes()
        total = cur_rgb.size[0] * cur_rgb.size[1]
        over = sum(
            1 for i in range(0, len(data), 3)
            if data[i] + data[i + 1] + data[i + 2] > PIXEL_DIFF_THRESHOLD
        )
        frac = over / total
        assert frac <= ALLOWED_DIFF_FRACTION, (
            f"{render.name}: visual drift {frac*100:.2f}% > "
            f"{ALLOWED_DIFF_FRACTION*100:.2f}% — re-render or update golden"
        )
```

- [ ] **Step 4: Run the new test file — all should skip cleanly (no templates yet)**

```bash
pytest features/instagram_content/test_render.py -v
```

Expected: ImportError → because `features.instagram_content.jobs` doesn't exist yet. **This is fine** — Task 3 will add it. Confirm the error is the import (not a syntax error in your test file). If the error is anything other than `ModuleNotFoundError: No module named 'features.instagram_content.jobs'`, fix and re-run.

- [ ] **Step 5: Commit**

```bash
git add tests/test_tokens_truth.py features/instagram_content/test_render.py
git commit -m "test(instagram): scaffold 4-layer test harness

- tests/test_tokens_truth.py: extend ALL_TEMPLATES with INSTAGRAM_TEMPLATES
- features/instagram_content/test_render.py: dimensions + safe-zone static
  + safe-zone runtime + visual regression (parametrized over jobs.py)

Test harness fails fast on import until jobs.py lands in next task —
expected, see plan."
```

---

## Task 3: `jobs.py` — declarative 27-job list

**Why now:** unblocks the test harness import and locks the contract for what gets rendered.

**Files:**
- Create: `features/instagram_content/jobs.py`

- [ ] **Step 1: Write `jobs.py`**

```python
"""
Declarative list of RenderJobs for the v1 Instagram launch batch.

Total: 27 PNGs = 6 single posts + 3 carousels × 7 slides each.

All renders are 1080×1350 (4:5 portrait, 2026 IG default).

Carousels parameterize slide content via ?slide=1..7 query string —
the carousel HTML reads location.search and switches the active slide.
"""
from __future__ import annotations

from pathlib import Path

from scripts.pipeline import RenderJob

FEATURE_DIR = Path(__file__).parent
TEMPLATES_DIR = FEATURE_DIR / "templates"
RENDERS_DIR = FEATURE_DIR / "renders"

W, H = 1080, 1350  # 4:5 portrait — 2026 IG default

SINGLES = (
    "single-manifesto",
    "single-cost-of-inaction",
    "single-niche-tag",
    "single-proof-number",
    "single-offer-mechanics",
    "single-cta-pure",
)

CAROUSELS: dict[str, int] = {
    "carousel-portfolio": 7,
    "carousel-services":  7,
    "carousel-process":   7,
}


def build_jobs() -> list[RenderJob]:
    jobs: list[RenderJob] = []
    for stem in SINGLES:
        jobs.append(RenderJob(
            source=TEMPLATES_DIR / f"{stem}.html",
            out=RENDERS_DIR / f"{stem}.png",
            width=W,
            height=H,
        ))
    for stem, n_slides in CAROUSELS.items():
        for i in range(1, n_slides + 1):
            jobs.append(RenderJob(
                source=TEMPLATES_DIR / f"{stem}.html",
                out=RENDERS_DIR / f"{stem}-slide-{i}.png",
                width=W,
                height=H,
                query=f"?slide={i}",
            ))
    return jobs
```

- [ ] **Step 2: Write a test that locks the job count contract**

Append to `features/instagram_content/test_render.py`:

```python
# ---------- Job declaration contract ---------------------------------------

def test_job_count_locked():
    """Spec §6 declares 27 renders. Anything else is a contract change."""
    jobs = build_jobs()
    assert len(jobs) == 27, f"expected 27 jobs, got {len(jobs)}"


def test_jobs_all_target_4_5_portrait():
    """All v1 IG renders are 1080×1350. Square or 9:16 leaks belong elsewhere."""
    for j in build_jobs():
        assert (j.width, j.height) == (1080, 1350), (
            f"job {j.out.name} has dimensions {j.width}x{j.height}, expected 1080x1350"
        )


def test_carousel_jobs_have_slide_query():
    jobs = [j for j in build_jobs() if "carousel-" in j.out.name]
    assert len(jobs) == 21, f"expected 21 carousel slides, got {len(jobs)}"
    for j in jobs:
        assert j.query.startswith("?slide="), (
            f"{j.out.name} missing ?slide= query (got {j.query!r})"
        )
```

- [ ] **Step 3: Run the contract tests**

```bash
pytest features/instagram_content/test_render.py::test_job_count_locked features/instagram_content/test_render.py::test_jobs_all_target_4_5_portrait features/instagram_content/test_render.py::test_carousel_jobs_have_slide_query -v
```

Expected: 3 PASS.

- [ ] **Step 4: Run all parametrized tests — should all skip (no renders yet, no templates yet)**

```bash
pytest features/instagram_content/test_render.py -v
```

Expected:
- 3 PASS (the contract tests above)
- 6 SKIPPED on `test_safe_zone_static` (parametrize iterates 0 templates → empty parametrize → no test cases generated; pytest reports as "no tests ran" for that node — this is fine)
- All `test_dimensions_match`, `test_safe_zone_runtime`, `test_visual_regression` cases SKIPPED with "Render missing" or "Golden missing"

If any FAIL: stop and fix before continuing.

- [ ] **Step 5: Commit**

```bash
git add features/instagram_content/jobs.py features/instagram_content/test_render.py
git commit -m "feat(instagram): declare 27-job contract in jobs.py

6 singles + 3 carousels × 7 slides = 27 PNGs at 1080x1350.
Carousels parameterize via ?slide=1..7 query string.

Locks the count + dimensions + carousel-query contracts via tests."
```

---

## Task 4: `render.py` — async entry-point

**Files:**
- Create: `features/instagram_content/render.py`

- [ ] **Step 1: Write `render.py`**

```python
"""
Render the v1 Instagram launch batch (27 PNGs).

Usage:
    python -m features.instagram_content.render
    # or via the unified CLI:
    python scripts/build.py --instagram
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from scripts.pipeline import run_jobs  # noqa: E402
from features.instagram_content.jobs import build_jobs, RENDERS_DIR  # noqa: E402


async def main() -> None:
    RENDERS_DIR.mkdir(parents=True, exist_ok=True)
    jobs = build_jobs()
    print(f"Rendering {len(jobs)} Instagram assets to {RENDERS_DIR}...")
    await run_jobs(jobs)
    for j in jobs:
        marker = "[OK]" if j.out.exists() and j.out.stat().st_size > 0 else "[FAIL]"
        print(f"  {marker} {j.out.name}")
    print(f"\nDone: {RENDERS_DIR.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Smoke-test the import path (no templates yet, so a real render will fail)**

```bash
python -c "from features.instagram_content.render import main; print('import OK')"
```

Expected output: `import OK`. If you get an `ImportError`, fix the path before continuing.

- [ ] **Step 3: Commit**

```bash
git add features/instagram_content/render.py
git commit -m "feat(instagram): add async render entry-point

Reuses scripts.pipeline.run_jobs for deterministic font loading.
Reports per-job [OK]/[FAIL] markers; no fallback rendering."
```

---

## Task 5: Author the 6 single templates

**Pattern (apply once per template):** write HTML+CSS using `brand/tokens.css` exclusively, ensure no critical text is positioned within 60px of top/bottom, render, capture golden, commit.

**Reference template structure** (copy into `single-manifesto.html`, then adapt copy + visual emphasis per template):

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../../../brand/tokens.css">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 1080px;
  height: 1350px;
  overflow: hidden;
  background: var(--bg);
  font-family: 'DM Sans', sans-serif;
  position: relative;
}

/* Critical text MUST keep top >= 60 and bottom >= 60. */
.hook {
  position: absolute;
  top: 200px;     /* example — adjust per template, but never < 60 */
  left: 64px;
  right: 64px;
  text-align: center;
}

.hook h1 {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 64px;
  color: var(--text);
  letter-spacing: -2px;
  line-height: 1.05;
}

.hook h1 em {
  font-style: normal;
  color: var(--accent);
}

.hook .sub {
  font-size: 22px;
  color: var(--text-muted);
  line-height: 1.5;
  margin-top: 24px;
}

.cta-bar {
  position: absolute;
  bottom: 120px;   /* never < 60 */
  left: 0;
  right: 0;
  text-align: center;
}

.cta-bar .handle::before {
  content: var(--ig-handle);
  font-size: 16px;
  color: var(--accent);
  letter-spacing: 0.08em;
}
</style>
</head>
<body>
  <div class="hook">
    <!-- HEADLINE goes here per template -->
    <!-- SUB goes here per template -->
  </div>
  <div class="cta-bar">
    <!-- CTA text + .handle for the @vibeweb.eu line -->
  </div>
</body>
</html>
```

**Copy strings (from spec §6):**

| Template | Headline | Sub | CTA |
|---|---|---|---|
| `single-manifesto.html` | "Most freelancers send a Notion link." | "You're not most freelancers." | "DM 'site' to start →" |
| `single-cost-of-inaction.html` | "Every week without a site," | "3 clients pick someone else." | "How long can you afford that?" |
| `single-niche-tag.html` | "Designers who can't afford a generic agency." | "Custom sites that look like your work, not their template." | "DM 'site' →" |
| `single-proof-number.html` | "6 sites. 7 days each." | "€450 minimum. Last month, every client said yes to round one." | "Yours next? →" |
| `single-offer-mechanics.html` | "€450. 7 days. Done." | "5 pages · Custom design · Real code · Live in a week." | "What's included →" |
| `single-cta-pure.html` | "Send 'site'." | "Get a Loom in 24h showing how I'd build yours." | (handle line — `<span class="handle"></span>`) |

**Per-template procedure (repeat 6 times):**

- [ ] **Step 1: Write the template** at `features/instagram_content/templates/<name>.html` — copy the reference structure above, then plug in the headline/sub/CTA from the table. Adapt visual emphasis (font-size, weight, color accent) to match the concept (manifesto = bold sans; offer-mechanics = stat-grid layout; cta-pure = minimalist with `<span class="handle"></span>` showing the handle token).

- [ ] **Step 2: Run static checks (immediate feedback, no Playwright needed)**

```bash
pytest tests/test_tokens_truth.py features/instagram_content/test_render.py::test_safe_zone_static -v
```

Expected: PASS for the new template (and all existing templates). If safe-zone fails, move text inward; if tokens-truth fails, replace any hex literal with a `var(--*)` token.

- [ ] **Step 3: Render and visually inspect**

```bash
python -m features.instagram_content.render
```

Open `features/instagram_content/renders/<name>.png` and verify:
- Headline + sub + CTA are all visible.
- Nothing critical falls in the top 60px or bottom 60px (visualize by mentally drawing a 60px crop).
- Brand greens look right (the token literal `#04d361`, not a near-miss).

- [ ] **Step 4: Run runtime safe-zone scan**

```bash
pytest features/instagram_content/test_render.py::test_safe_zone_runtime -v -k "<name>"
```

Expected: PASS. If it fails, the rendered output has bleed into the safe-zone — adjust `top:`, `bottom:`, padding, or font-size.

- [ ] **Step 5: Commit the template**

```bash
git add features/instagram_content/templates/<name>.html
git commit -m "feat(instagram): add <name> template

PAS slot: <Problem|Agitate|Solution|CTA>. Copy from spec §6.
Safe-zone validated (static + runtime). Tokens-truth clean."
```

**Repeat steps 1-5 for each of the 6 single templates.** Suggested order (lowest visual risk → highest):
1. `single-manifesto.html`
2. `single-cost-of-inaction.html`
3. `single-niche-tag.html`
4. `single-proof-number.html`
5. `single-offer-mechanics.html` (stat-grid layout — slightly more complex)
6. `single-cta-pure.html` (uses `--ig-handle` token directly)

After all 6: run `pytest -q` and confirm 6 new template tests pass + no regression.

---

## Task 6: `carousel-portfolio.html` — 7 parameterized slides

**Concept:** Slide 1 = hook, slides 2-6 = one site screenshot each, slide 7 = CTA. Slide content is selected by `?slide=N` via inline JS that reads `location.search` and toggles `[data-slide="N"]` visibility (mirrors existing pattern in `instagram-highlight.html?type=...`).

**Reference for query-string switching:** read `brand/social/templates/instagram-highlight.html` first to understand the pattern (it switches by `?type=` rather than `?slide=`, but the JS is structurally identical).

**Files:**
- Create: `features/instagram_content/templates/carousel-portfolio.html`

**Slide content:**

| Slide | Content |
|---|---|
| 1 | "6 sites I built in 60 days. Pick a favorite. →" (hook + arrow) |
| 2 | `site-onearc.png` + "Onearc — SaaS landing in 6 days" |
| 3 | `site-alytics.png` + "Alytics — analytics dashboard, 7 days" |
| 4 | `site-lunera.png` + "Lunera — wellness brand, 5 days" |
| 5 | `site-messageai.png` + "MessageAI — product launch site, 7 days" |
| 6 | `site-dreelio.png` + "Dreelio — creator portfolio, 4 days" |
| 7 | "Yours next? DM 'site' to start." (CTA) |

- [ ] **Step 1: Read existing `?` switching pattern**

```bash
cat brand/social/templates/instagram-highlight.html
```

Note how it uses `data-type` attributes + a small `<script>` that toggles `display: none` on inactive blocks. Follow the same pattern with `data-slide`.

- [ ] **Step 2: Write `carousel-portfolio.html`**

Structure: `body { width: 1080px; height: 1350px; }` with 7 `<section data-slide="N">` blocks. Inline `<script>`:

```html
<script>
  const params = new URLSearchParams(location.search);
  const slide = params.get('slide') || '1';
  document.querySelectorAll('[data-slide]').forEach(el => {
    el.style.display = el.dataset.slide === slide ? 'flex' : 'none';
  });
</script>
```

CSS uses a `.slide` base class for shared layout, `.slide-hook` / `.slide-portfolio` / `.slide-cta` modifiers per slide type. Asset references: `<img src="../../../ads/assets/site-onearc.png">` etc.

For the portfolio slides (2-6), use a centered device-frame mockup (reuse `ads/assets/macbook-frame.png` — see `ads/templates/06-niche-designers.html` for the proportions). Site name + duration label below the mockup.

For all slides: `top` of headline element ≥ 60px, `bottom` of CTA element ≥ 60px.

- [ ] **Step 3: Static checks**

```bash
pytest tests/test_tokens_truth.py features/instagram_content/test_render.py::test_safe_zone_static -v -k "carousel-portfolio"
```

Expected: PASS.

- [ ] **Step 4: Render all 7 slides**

```bash
python -m features.instagram_content.render
```

Inspect `renders/carousel-portfolio-slide-{1..7}.png`. Verify:
- Slide 1 shows ONLY the hook (other slides hidden).
- Slides 2-6 each show ONLY their respective site mockup.
- Slide 7 shows ONLY the CTA.

If a slide shows multiple visible sections, the JS query parsing is broken — debug `URLSearchParams` usage.

- [ ] **Step 5: Runtime safe-zone for all 7 slides**

```bash
pytest features/instagram_content/test_render.py::test_safe_zone_runtime -v -k "carousel-portfolio"
```

Expected: 7 PASS.

- [ ] **Step 6: Commit**

```bash
git add features/instagram_content/templates/carousel-portfolio.html
git commit -m "feat(instagram): carousel-portfolio template (7 parameterized slides)

Slide 1 hook + slides 2-6 reuse 6 site screenshots from ads/assets/
+ slide 7 CTA. JS reads ?slide=N and toggles visibility.

Open-loop: arrow on slide 1 promises curated picks; payoff is the CTA.
Safe-zone (static + runtime) validated for all 7 slides."
```

---

## Task 7: `carousel-services.html` — 7 parameterized slides

**Open-loop discipline:** slide 1 says "what you get"; slide 5 reveals "what you DON'T get" — keeps swipe momentum.

**Slide content (from spec §6):**

| Slide | Content |
|---|---|
| 1 | "What you get for €450" (open-loop hook) |
| 2 | "5 pages. Custom design. Mobile-first." |
| 3 | "Copy that converts. Not template fluff." |
| 4 | "SEO basics built in. Analytics. Forms." |
| 5 | "What you don't get." (open-loop reveal) |
| 6 | "Templates. Generic stock photos. 6-week timelines." |
| 7 | "Ready in 7 days. DM 'site' →" |

**Per spec §6 the visual treatment differs from portfolio:** card-style layout, no device mockups. Slide 5 deliberately mirrors slide 1 in layout to telegraph the open-loop reveal (visual rhyme).

- [ ] **Step 1: Write `carousel-services.html`** — same parameterized structure as portfolio, different content + layout. The slide-5 reveal should be visually distinct (e.g., red accent on "DON'T") to maximize swipe surprise.

- [ ] **Step 2-5: Same procedure as Task 6** — static checks, render, runtime safe-zone, visual inspection of all 7 slides.

- [ ] **Step 6: Commit**

```bash
git add features/instagram_content/templates/carousel-services.html
git commit -m "feat(instagram): carousel-services template (7 slides, open-loop)

Slide 1 sets up 'what you get'; slide 5 reveals 'what you don't get'
to break swipe-fatigue. Slide 7 = DM CTA.

Safe-zone validated for all 7 slides."
```

---

## Task 8: `carousel-process.html` — 7 parameterized slides

**Concept:** Day 1 → Day 7 progression. Each slide should feel like a step (number prominent, day label, action sentence).

**Slide content (from spec §6):**

| Slide | Content |
|---|---|
| 1 | "How I deliver in 7 days. (No, it's not a template.)" |
| 2 | "Day 1 — Brief. 30-min call. I take notes; you don't." |
| 3 | "Day 2-3 — Design. Figma in 48h. One round of changes free." |
| 4 | "Day 4-5 — Build. Real code. No-code = no thanks." |
| 5 | "Day 6 — Polish + SEO + speed." |
| 6 | "Day 7 — Launch. You get the keys." |
| 7 | "DM 'site' if this sounds like your week." |

- [ ] **Step 1-6: Same procedure as Tasks 6-7.** For slides 2-6, render the day number large (Syne 800, ~120px) with the action sentence below in DM Sans 28-32px.

```bash
git add features/instagram_content/templates/carousel-process.html
git commit -m "feat(instagram): carousel-process template (7 slides, day-by-day)

Slide 1 hook + slides 2-6 = Day 1 → Day 7 timeline + slide 7 CTA.
Numerical progression as visual anchor across slides.

Safe-zone validated for all 7 slides."
```

---

## Task 9: CLI integration — `scripts/build.py --instagram`

**Files:**
- Modify: `scripts/build.py`
- Modify: `tests/test_build_cli.py`

- [ ] **Step 1: Read existing `tests/test_build_cli.py`**

```bash
cat tests/test_build_cli.py
```

Identify the test pattern for `--brand` and `--ads`. Mirror it for `--instagram`.

- [ ] **Step 2: Add a failing test for `--instagram`**

Append to `tests/test_build_cli.py` (using whatever pattern exists — likely a `subprocess.run` or `runpy` invocation that asserts the script's argparse accepts the flag):

```python
def test_build_accepts_instagram_flag():
    """build.py --instagram parses without error and routes to features.instagram_content.render."""
    import subprocess
    import sys
    result = subprocess.run(
        [sys.executable, "scripts/build.py", "--instagram", "--help"],
        capture_output=True, text=True,
    )
    # If --help exits 0, argparse parsed the flag definition successfully.
    # If --help is rejected because of mutex group, this still validates the flag exists.
    assert "--instagram" in result.stdout or "--instagram" in result.stderr
```

(Adapt the assertion to whatever idiom the file already uses.)

- [ ] **Step 3: Run the test — should FAIL**

```bash
pytest tests/test_build_cli.py::test_build_accepts_instagram_flag -v
```

Expected: FAIL.

- [ ] **Step 4: Modify `scripts/build.py`**

Edit the argparse block (around lines 22-26):

```python
g.add_argument("--brand", action="store_true", help="Generate brand pack (logos, social, favicons)")
g.add_argument("--ads", action="store_true", help="Render ad creatives")
g.add_argument("--instagram", action="store_true", help="Render Instagram content batch (9 grid posts + 21 carousel slides)")
g.add_argument("--all", action="store_true", help="Run the full pipeline")
```

And in the dispatch block (around lines 28-33):

```python
if args.brand or args.all:
    from scripts.generate import main as gen_main
    asyncio.run(gen_main())
if args.ads or args.all:
    from ads.render import main as ads_main
    asyncio.run(ads_main())
if args.instagram or args.all:
    from features.instagram_content.render import main as ig_main
    asyncio.run(ig_main())
```

- [ ] **Step 5: Run test — should PASS**

```bash
pytest tests/test_build_cli.py::test_build_accepts_instagram_flag -v
```

Expected: PASS.

- [ ] **Step 6: Smoke-test the CLI**

```bash
python scripts/build.py --instagram
```

Expected: 27 PNGs render to `features/instagram_content/renders/` with `[OK]` markers.

- [ ] **Step 7: Smoke-test `--all`**

```bash
python scripts/build.py --all
```

Expected: brand + ads + instagram all render. Total runtime under ~90 seconds.

- [ ] **Step 8: Commit**

```bash
git add scripts/build.py tests/test_build_cli.py
git commit -m "feat(cli): add --instagram flag to build.py

--instagram renders only the IG content batch.
--all extended to chain brand → ads → instagram.

Test verifies argparse exposes the flag."
```

---

## Task 10: Author goldens (manual visual review + commit)

**Why now:** all templates render successfully; safe-zone passes; visual regression test currently SKIPS because no goldens exist. This task transitions visual regression from skipping to active.

**Files:**
- Create: `features/instagram_content/goldens/*.png` (27 PNGs)

- [ ] **Step 1: Render the full batch fresh**

```bash
rm -f features/instagram_content/renders/*.png
python scripts/build.py --instagram
```

Expected: 27 PNGs in `features/instagram_content/renders/`.

- [ ] **Step 2: Visual review — open each PNG**

For each of the 27 PNGs in `renders/`, verify:
- Brand colors look right (greens are vibrant `#04d361`, not muted).
- Typography is correct (Syne for headlines, DM Sans for body, Fira Code never used here).
- No fallback fonts (if you see Times-like serifs, `document.fonts.ready` failed — debug pipeline).
- Critical text outside the top 60px and bottom 60px (mentally crop).
- For carousels: each slide-N looks visually distinct from slide-(N±1).
- For carousel-portfolio slides 2-6: site screenshots load (no broken `<img>` placeholders).

If anything is wrong, **stop and fix the offending template** before authoring goldens. Goldens lock the current state; baking in a bug here means it persists invisible until manually unrolled.

- [ ] **Step 3: Copy renders to goldens**

```bash
mkdir -p features/instagram_content/goldens
cp features/instagram_content/renders/*.png features/instagram_content/goldens/
```

- [ ] **Step 4: Run the full visual regression test**

```bash
pytest features/instagram_content/test_render.py::test_visual_regression -v
```

Expected: 27 PASS (every render matches its just-copied golden, ≤ 0% drift).

- [ ] **Step 5: Run the entire test suite to confirm no regression**

```bash
pytest -q
```

Expected: all green. Total count = 141 (baseline) + new IG tests. The number depends on parametrization counts; verify only that there are no FAILs or ERRORs.

- [ ] **Step 6: Commit goldens**

```bash
git add features/instagram_content/goldens/
git commit -m "feat(instagram): commit v1 goldens (27 PNGs)

Locks visual regression baseline after manual review of every render.
Goldens were authored from a clean --instagram run on commit
$(git rev-parse --short HEAD)."
```

(Substitute the actual short SHA in the message before running.)

---

## Task 11: Final verification gate

**Files:** none modified. This is a verification-only task.

- [ ] **Step 1: Re-run from a clean slate**

```bash
rm -rf features/instagram_content/renders/
python scripts/build.py --all
```

Expected: brand + ads + instagram complete in <90s. All `[OK]` markers; no warnings.

- [ ] **Step 2: Run the entire test suite**

```bash
pytest -q
```

Expected: all green. The new IG tests should run (not skip), since renders + goldens both exist now.

- [ ] **Step 3: Visual regression sanity check**

```bash
pytest features/instagram_content/test_render.py::test_visual_regression -v
```

Expected: 27 PASS. If anything drifts, the render pipeline is non-deterministic and we have a real bug.

- [ ] **Step 4: Confirm goldens are committed and renders are gitignored**

```bash
git check-ignore features/instagram_content/renders/single-manifesto.png
git ls-files features/instagram_content/goldens/ | wc -l
```

Expected: first command echoes the path (gitignored), second outputs `27`.

- [ ] **Step 5: Run the Review Gate per CLAUDE.md**

Per devflow CLAUDE.md "Review Gate" section, before declaring DONE:

```
Invoke pr-review-toolkit:review-pr to validate logic, quality, regressions,
and design system adherence on the IG content factory diff.
```

If the review surfaces issues: fix them, then return to Step 1.

- [ ] **Step 6: Update the devflow state to COMPLETED**

```bash
# Replace the STARTED_AT timestamp from the actual session state file.
cat ~/.claude/devflow/state/default/active-spec.json
# Then write COMPLETED:
```

Edit `~/.claude/devflow/state/default/active-spec.json` and set:
```json
{"status": "COMPLETED", "plan_path": "docs/plans/2026-04-29-instagram-content-factory.md", "started_at": <preserve original>}
```

- [ ] **Step 7: Final commit (if any state-file changes)**

The state file is outside the repo, so no commit needed. The feature is done when:
1. All checkboxes in this plan are checked.
2. Working tree clean.
3. `pytest -q` all green.
4. Review Gate clean.

---

## Reference: skills to invoke during execution

- `superpowers:test-driven-development` — every behavior gets a test first.
- `superpowers:verification-before-completion` — run the full pytest before claiming done.
- `frontend-design:frontend-design` — invoke before authoring each template (visual silence, hierarchy, WCAG AA contrast — IG is a marketing surface but the bones are still UI).
- `pr-review-toolkit:review-pr` — Review Gate at Task 11.

## What's deliberately NOT in this plan (per spec §13)

- Reels / video (Spec D)
- Story templates beyond what's already rendered
- Conversion funnel: DM auto-reply, vibeweb.eu/start landing, CRM (Spec E)
- Highlight cover redesign (existing 5 reused)
- LLM copy generation (Spec 1 territory)
- Multi-language
- Posting cadence automation
- Meta Marketing API integration
- A/B variation orchestration
