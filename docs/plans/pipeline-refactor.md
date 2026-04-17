# Pipeline Refactor — Tokens-as-Truth, Unified Build, Visual Regression

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Vibe Web asset pipeline from two bifurcated scripts with decorative token imports into a single deterministic CLI where `tokens.css` is the real source of truth and tests catch visual regressions — not just file sizes.

**Architecture:**
- New shared module `scripts/pipeline.py` owns Playwright lifecycle, `to_file_url`, and a `wait_for_fonts()` helper using `document.fonts.ready`.
- Single entry point `scripts/build.py` orchestrates brand + ads with flags (`--brand`, `--ads`, `--all`).
- All templates (brand + ads) import `brand/tokens.css` and consume `var(--*)`. Hex literals restricted to `tokens.css` itself.
- Legacy `#0d0d0d` migrated to canonical `#0a0a0a` across 15 files.
- `vibeweb-icon.svg` is read from disk inside `generate.py` (no more inline duplication).
- Favicons 16/32/180 generated natively via Playwright at target resolution from the SVG, not downscaled from a 512px PNG.
- Golden-image regression tests via Pillow `ImageChops` for 1 ad + 1 social + 1 logo, with tolerance threshold.
- `pyproject.toml` pins dependencies for reproducibility.
- `vibeweb-logo-hd.png` is deleted (orphan, not produced by any pipeline, not covered by tests).

**Tech Stack:** Python 3.11+, Playwright (chromium), Pillow (image ops + golden diffs), pytest, pytest-asyncio.

---

## File Structure

**New files:**
- `pyproject.toml` — project metadata, pinned deps.
- `scripts/pipeline.py` — shared Playwright helpers (`to_file_url`, `render_page`, `wait_for_fonts`, `playwright_context`).
- `scripts/build.py` — unified CLI entry point (`python scripts/build.py --all`).
- `tests/goldens/` — reference PNGs for visual regression (one per render type).
- `tests/test_visual_regression.py` — perceptual diff tests against goldens.
- `tests/test_tokens_truth.py` — enforces tokens.css import and var(--*) usage across templates.

**Modified files:**
- `brand/tokens.css` — add tokens for every hex currently in templates (already has most).
- `brand/social/templates/*.html` (5 files) — import tokens.css, replace hex with `var(--*)`, migrate `#0d0d0d` → `#0a0a0a`.
- `ads/templates/*.html` (6 files) — replace hex with `var(--*)`. Already import tokens.css.
- `brand/guidelines.html`, `brand/guidelines.css` — migrate to tokens, replace `#0d0d0d`.
- `brand/logos/*.svg` (5 files with `#0d0d0d`) — migrate to `#0a0a0a`.
- `scripts/generate.py` — use `scripts.pipeline`, read icon SVG from disk, generate favicons natively, use `#0a0a0a`.
- `ads/render.py` — use `scripts.pipeline`, remove duplicated helpers and 1500ms timeout.
- `tests/test_generate.py` — replace pinned `#0d0d0d` assertions with tokens-truth assertions.
- `ads/test_render.py` — expand beyond dimension-only checks.
- `tests/conftest.py` — ensure `scripts/` on path; register new markers.
- `README.md` — reflect post-refactor reality (unified CLI, golden tests, pyproject).

**Deleted files:**
- `brand/logos/vibeweb-logo-hd.png` — orphan.

---

## Task 1: Reproducibility — `pyproject.toml`

**Files:**
- Create: `pyproject.toml`
- Modify: `README.md` (install instructions)

- [ ] **Step 1: Write failing test that verifies pyproject.toml exists and declares required deps**

`tests/test_packaging.py`:
```python
import tomllib
from pathlib import Path

def test_pyproject_exists():
    assert (Path(__file__).parent.parent / "pyproject.toml").is_file()

def test_pyproject_pins_core_deps():
    path = Path(__file__).parent.parent / "pyproject.toml"
    with path.open("rb") as f:
        data = tomllib.load(f)
    deps = data["project"]["dependencies"]
    pinned = {d.split(">=")[0].split("==")[0].strip(): d for d in deps}
    assert "playwright" in pinned
    assert "pillow" in pinned
    for name, spec in pinned.items():
        assert any(op in spec for op in (">=", "==", "~=")), f"{name} is unpinned"

def test_pyproject_pins_dev_deps():
    path = Path(__file__).parent.parent / "pyproject.toml"
    with path.open("rb") as f:
        data = tomllib.load(f)
    dev = data["project"]["optional-dependencies"]["dev"]
    pinned = {d.split(">=")[0].split("==")[0].strip(): d for d in dev}
    assert "pytest" in pinned
    assert "pytest-asyncio" in pinned
```

- [ ] **Step 2: Run test — expect FAIL (no pyproject.toml)**

Run: `pytest tests/test_packaging.py -v`
Expected: 3 failures.

- [ ] **Step 3: Create `pyproject.toml`**

```toml
[project]
name = "vibeweb"
version = "0.1.0"
description = "Vibe Web brand identity + ad creatives pipeline"
requires-python = ">=3.11"
dependencies = [
    "playwright>=1.47,<2.0",
    "pillow>=10.4,<12.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3,<9.0",
    "pytest-asyncio>=0.24,<1.0",
]

[project.scripts]
vibeweb-build = "scripts.build:main"

[tool.pytest.ini_options]
markers = [
    "integration: requires generate.py already run (produces PNGs)",
    "visual: perceptual golden-image comparison",
]
asyncio_mode = "auto"
```

- [ ] **Step 4: Run test — expect PASS**

Run: `pytest tests/test_packaging.py -v`
Expected: 3 passes.

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml tests/test_packaging.py
git commit -m "build: add pyproject.toml with pinned dependencies"
```

---

## Task 2: Shared Pipeline Module

**Files:**
- Create: `scripts/pipeline.py`
- Create: `tests/test_pipeline.py`

- [ ] **Step 1: Write failing unit tests**

`tests/test_pipeline.py`:
```python
from pathlib import Path
from scripts.pipeline import to_file_url, FONT_READY_SCRIPT

def test_to_file_url_returns_file_uri():
    url = to_file_url(Path(__file__))
    assert url.startswith("file:///")
    assert "test_pipeline" in url

def test_to_file_url_handles_spaces(tmp_path):
    p = tmp_path / "has spaces.html"
    p.write_text("x", encoding="utf-8")
    url = to_file_url(p)
    assert url.startswith("file:///")
    assert "%20" in url  # spaces escaped

def test_font_ready_script_awaits_document_fonts():
    assert "document.fonts.ready" in FONT_READY_SCRIPT
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

Run: `pytest tests/test_pipeline.py -v`

- [ ] **Step 3: Create `scripts/pipeline.py`**

```python
"""
Shared Playwright helpers for Vibe Web asset pipelines.

All rendering functions in scripts/generate.py and ads/render.py should
go through this module. No duplicate to_file_url or wait loops.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import AsyncIterator

FONT_READY_SCRIPT = "document.fonts.ready"


def to_file_url(path: Path) -> str:
    """Convert a local path to a file:// URL (Windows-safe, space-safe)."""
    return path.resolve().as_uri()


@dataclass(frozen=True)
class RenderJob:
    """A single screenshot job: source HTML, output PNG, viewport dimensions."""
    source: Path
    out: Path
    width: int
    height: int
    query: str = ""  # appended to URL, e.g. "?type=portfolio"


@asynccontextmanager
async def playwright_page() -> AsyncIterator:
    """Yield a fresh Playwright page in a chromium browser; tears down on exit."""
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        try:
            page = await browser.new_page()
            yield page
        finally:
            await browser.close()


async def wait_for_fonts(page) -> None:
    """Deterministic font-ready signal — replaces arbitrary sleep."""
    await page.evaluate(FONT_READY_SCRIPT)


async def render_job(page, job: RenderJob) -> None:
    """Render a single RenderJob: navigate, wait for network+fonts, screenshot."""
    await page.set_viewport_size({"width": job.width, "height": job.height})
    url = to_file_url(job.source) + job.query
    await page.goto(url)
    await page.wait_for_load_state("networkidle")
    await wait_for_fonts(page)
    job.out.parent.mkdir(parents=True, exist_ok=True)
    await page.screenshot(
        path=str(job.out),
        clip={"x": 0, "y": 0, "width": job.width, "height": job.height},
    )


async def render_html_string(page, html: str, out: Path, width: int, height: int) -> None:
    """Render an HTML string (for inline SVG wrappers). Same determinism guarantees."""
    await page.set_viewport_size({"width": width, "height": height})
    await page.set_content(html)
    await page.wait_for_load_state("networkidle")
    await wait_for_fonts(page)
    out.parent.mkdir(parents=True, exist_ok=True)
    await page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": width, "height": height})


async def run_jobs(jobs: list[RenderJob]) -> None:
    """Run a batch of RenderJobs in a single browser context."""
    async with playwright_page() as page:
        for job in jobs:
            await render_job(page, job)
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pytest tests/test_pipeline.py -v`

- [ ] **Step 5: Commit**

```bash
git add scripts/pipeline.py tests/test_pipeline.py
git commit -m "feat(pipeline): extract shared Playwright helpers with document.fonts.ready"
```

---

## Task 3: Migrate tokens.css — Brand Social Templates

**Files:**
- Modify: `brand/social/templates/instagram-post.html`
- Modify: `brand/social/templates/instagram-story.html`
- Modify: `brand/social/templates/instagram-highlight.html`
- Modify: `brand/social/templates/linkedin-banner.html`
- Modify: `brand/social/templates/og-image.html`
- Modify: `brand/tokens.css` (add any missing semantic tokens)
- Create: `tests/test_tokens_truth.py`

- [ ] **Step 1: Write failing tests — `tests/test_tokens_truth.py`**

```python
"""
Enforce tokens.css as the real source of truth.

Rules:
- Every template HTML must <link> tokens.css.
- Templates must NOT hardcode the legacy #0d0d0d.
- Templates must use var(--*) for core brand colors (sampled set).
"""
import re
from pathlib import Path
import pytest

ROOT = Path(__file__).parent.parent

BRAND_TEMPLATES = sorted((ROOT / "brand" / "social" / "templates").glob("*.html"))
AD_TEMPLATES = sorted((ROOT / "ads" / "templates").glob("*.html"))
ALL_TEMPLATES = BRAND_TEMPLATES + AD_TEMPLATES

LEGACY_BG_PATTERN = re.compile(r"#0d0d0d", re.IGNORECASE)
TOKENS_IMPORT = re.compile(r'<link[^>]+href="[^"]*brand/tokens\.css"', re.IGNORECASE)
VAR_USAGE = re.compile(r"var\(--[a-z][a-z0-9-]*\)")


@pytest.mark.parametrize("tpl", ALL_TEMPLATES, ids=lambda p: p.name)
def test_template_imports_tokens_css(tpl):
    content = tpl.read_text(encoding="utf-8")
    assert TOKENS_IMPORT.search(content), f"{tpl.name} must import brand/tokens.css"


@pytest.mark.parametrize("tpl", ALL_TEMPLATES, ids=lambda p: p.name)
def test_template_uses_var_for_core_colors(tpl):
    content = tpl.read_text(encoding="utf-8")
    assert VAR_USAGE.search(content), f"{tpl.name} must use var(--*) tokens"


@pytest.mark.parametrize("tpl", ALL_TEMPLATES, ids=lambda p: p.name)
def test_template_has_no_legacy_background(tpl):
    content = tpl.read_text(encoding="utf-8")
    assert not LEGACY_BG_PATTERN.search(content), (
        f"{tpl.name} still contains legacy #0d0d0d — migrate to var(--bg) / #0a0a0a"
    )


def test_tokens_css_declares_canonical_bg():
    tokens = (ROOT / "brand" / "tokens.css").read_text(encoding="utf-8")
    assert "--bg:" in tokens
    assert "#0a0a0a" in tokens
    assert "#0d0d0d" not in tokens


def test_no_legacy_bg_in_svgs():
    svgs = list((ROOT / "brand" / "logos").glob("*.svg"))
    offenders = [s.name for s in svgs if LEGACY_BG_PATTERN.search(s.read_text(encoding="utf-8"))]
    assert not offenders, f"SVGs with legacy #0d0d0d: {offenders}"
```

- [ ] **Step 2: Run — expect FAIL on every template + SVG**

Run: `pytest tests/test_tokens_truth.py -v`

- [ ] **Step 3: Migrate each brand/social template**

For each of the 5 templates in `brand/social/templates/`:
1. Inject `<link rel="stylesheet" href="../../tokens.css">` in `<head>`.
2. Replace every `#0d0d0d` with `var(--bg)`.
3. Replace every `#04d361` with `var(--accent)`.
4. Replace every `#ffffff` on text with `var(--text)`; when used as brand-inverse bg, leave hex.
5. Replace greys matching tokens (`#a3a3a3`, `#999`, `#888`, `#2a2a2a`) with `var(--text-muted)`, `var(--text-soft)`, `var(--text-subtle)`, `var(--border)`.

Also add any missing tokens to `brand/tokens.css` (audit pass — expect ~1-2 additions max).

- [ ] **Step 4: Run — expect PASS for brand templates, still FAIL for ad templates and SVGs**

Run: `pytest tests/test_tokens_truth.py -v`

- [ ] **Step 5: Commit**

```bash
git add brand/social/templates brand/tokens.css tests/test_tokens_truth.py
git commit -m "refactor(brand): migrate social templates to tokens.css as source of truth"
```

---

## Task 4: Migrate tokens.css — Ad Templates

**Files:**
- Modify: `ads/templates/*.html` (6 files)

Ad templates already import tokens.css (ceremonial) — now make the import mean something.

- [ ] **Step 1: Confirm failing tests from Task 3 still fail for ads**

Run: `pytest tests/test_tokens_truth.py::test_template_uses_var_for_core_colors -v`
Expected: failures on all 6 ad templates.

- [ ] **Step 2: For each ad template, replace hex with var(--*)**

Replace patterns:
- `background: #0a0a0a` / `background: #0d0d0d` → `background: var(--bg)`
- `color: #04d361` → `color: var(--accent)`
- `color: #ffffff` → `color: var(--text)`
- `color: #a3a3a3` / `#999` / `#888` → `var(--text-muted)` / `var(--text-soft)` / `var(--text-subtle)`
- Borders `#1e1e1e` / `#2a2a2a` → `var(--border)`

Rule: keep hex ONLY where no token fits semantically. Document with a comment if retained.

- [ ] **Step 3: Run — expect PASS for tokens-truth tests**

Run: `pytest tests/test_tokens_truth.py -v`
Expected: all template tests pass; SVG test still fails.

- [ ] **Step 4: Re-render ads to confirm no visual drift from token substitution**

Run: `python ads/render.py` (still old module — OK, we're mid-refactor)
Visually inspect `ads/renders/*.png`.

- [ ] **Step 5: Commit**

```bash
git add ads/templates
git commit -m "refactor(ads): replace hex literals with tokens.css var(--*)"
```

---

## Task 5: Migrate Legacy BG — SVGs + Guidelines + generate.py

**Files:**
- Modify: `brand/logos/vibeweb-primary.svg`
- Modify: `brand/logos/vibeweb-stacked.svg`
- Modify: `brand/logos/vibeweb-wordmark.svg`
- Modify: `brand/logos/vibeweb-icon.svg`
- Modify: `brand/logos/vibeweb-black.svg` (check — may use #0d0d0d as accent)
- Modify: `brand/guidelines.html`
- Modify: `brand/guidelines.css`
- Modify: `scripts/generate.py` (remaining `#0d0d0d` in wrapper HTMLs)
- Modify: `tests/test_generate.py`

- [ ] **Step 1: Update `tests/test_generate.py` — remove pinned #0d0d0d checks**

Delete or replace these:
- `test_icon_svg_has_dark_background` → rename to `test_icon_svg_has_canonical_bg`, expect `#0a0a0a`.
- `test_all_templates_have_dark_background` → **DELETE** (superseded by `test_tokens_truth.py`).

- [ ] **Step 2: Run — expect FAIL on renamed tests (SVGs still have #0d0d0d)**

Run: `pytest tests/test_generate.py -v`

- [ ] **Step 3: Migrate each SVG and guidelines**

For each affected file, global-replace `#0d0d0d` → `#0a0a0a`. Verify white logo (`vibeweb-white.svg`) and black logo (`vibeweb-black.svg`) still render correctly — they may not contain legacy bg.

Review guidelines.html/css: replace `#0d0d0d` with `var(--bg)` where inline styles exist; otherwise `#0a0a0a`.

- [ ] **Step 4: Migrate `scripts/generate.py`**

- Replace `background:#0d0d0d` in both SVG-wrapper HTMLs (lines 53, 106) with `background:#0a0a0a`.
- Read `vibeweb-icon.svg` from disk instead of inlining:

```python
icon_svg = (LOGOS_DIR / "vibeweb-icon.svg").read_text(encoding="utf-8")
icon_html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>*{{margin:0;padding:0}}body{{background:#0a0a0a;width:512px;height:512px;display:flex;align-items:center;justify-content:center}}</style>
</head><body>{icon_svg}</body></html>"""
```

- [ ] **Step 5: Run — expect PASS across all token/SVG/generate tests**

Run: `pytest tests/test_tokens_truth.py tests/test_generate.py -v`

- [ ] **Step 6: Commit**

```bash
git add brand/logos brand/guidelines.html brand/guidelines.css scripts/generate.py tests/test_generate.py
git commit -m "refactor(brand): migrate legacy #0d0d0d → canonical #0a0a0a across SVGs + generate.py"
```

---

## Task 6: Adopt Shared Pipeline in generate.py + render.py

**Files:**
- Modify: `scripts/generate.py`
- Modify: `ads/render.py`

- [ ] **Step 1: Replace `ads/render.py` with RenderJob-based implementation**

```python
"""
Render Meta Ads creatives from templates/*.html -> renders/*.png (1080x1080).
Uses scripts.pipeline for deterministic font loading.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from scripts.pipeline import RenderJob, run_jobs

ADS_DIR = Path(__file__).parent
TEMPLATES_DIR = ADS_DIR / "templates"
RENDERS_DIR = ADS_DIR / "renders"
SIZE = 1080


def build_jobs() -> list[RenderJob]:
    RENDERS_DIR.mkdir(exist_ok=True)
    return [
        RenderJob(source=tpl, out=RENDERS_DIR / f"{tpl.stem}.png", width=SIZE, height=SIZE)
        for tpl in sorted(TEMPLATES_DIR.glob("*.html"))
    ]


async def main():
    jobs = build_jobs()
    print(f"Rendering {len(jobs)} ad creatives...")
    await run_jobs(jobs)
    print(f"Done: {RENDERS_DIR.resolve()}")


# Keep legacy exports for test_render.py backward compat
def to_file_url(path: Path) -> str:
    from scripts.pipeline import to_file_url as _t
    return _t(path)


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Refactor `scripts/generate.py` to use shared pipeline**

Replace the entire `async def main()` body with RenderJob assembly + `run_jobs()`. Keep `generate_favicons()` but mark as deprecated (replaced in Task 7).

Delete the local `to_file_url`, `screenshot_html`, `screenshot_html_with_query`, `render_svg_logo` in favor of pipeline helpers. The inline SVG wrapper for logos becomes a small `render_svg_logo(page, svg_path, out, w, h)` that uses `render_html_string()`.

- [ ] **Step 3: Run ad render pipeline end-to-end**

Run: `python ads/render.py`
Expected: 6 PNGs produced, all 1080×1080, no 1500ms timeout waste.

- [ ] **Step 4: Run brand generator end-to-end**

Run: `python scripts/generate.py`
Expected: same 15 output files, identical dimensions.

- [ ] **Step 5: Run full test suite**

Run: `pytest -v`
Expected: all green (may need to update `ads/test_render.py` import path).

- [ ] **Step 6: Commit**

```bash
git add scripts/generate.py ads/render.py ads/test_render.py
git commit -m "refactor(pipeline): consolidate generate.py + render.py onto scripts.pipeline"
```

---

## Task 7: Native Favicon Generation via Playwright

**Files:**
- Modify: `scripts/generate.py` (replace `generate_favicons`)
- Modify: `tests/test_generate.py` (add sharpness assertion)

Pillow LANCZOS downscale from 512→16 loses detail. Render SVG at target size directly.

- [ ] **Step 1: Write failing test — favicons meet minimum byte threshold implying real detail**

`tests/test_generate.py` (append):
```python
@pytest.mark.integration
@pytest.mark.parametrize("size,min_bytes", [(16, 200), (32, 400), (180, 2000)])
def test_favicon_has_real_detail(size, min_bytes):
    name = {16: "favicon-16.png", 32: "favicon-32.png", 180: "apple-touch-icon.png"}[size]
    path = BASE / "favicons" / name
    assert path.stat().st_size >= min_bytes, (
        f"{name} is {path.stat().st_size}B — below {min_bytes}B threshold, "
        f"likely downscaled instead of natively rendered"
    )
```

Note: current `favicon-16.png` is 416B — passes. Threshold 200B is a floor for "not empty noise"; we aim for higher after native render.

- [ ] **Step 2: Replace `generate_favicons()` in `scripts/generate.py`**

```python
async def generate_favicons_native(page):
    """Render SVG natively at each favicon resolution — no LANCZOS lossy downscale."""
    icon_svg = (LOGOS_DIR / "vibeweb-icon.svg").read_text(encoding="utf-8")
    for fname, size in [
        ("favicon-16.png", 16),
        ("favicon-32.png", 32),
        ("apple-touch-icon.png", 180),
        ("icon-512.png", 512),
    ]:
        html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{{margin:0;padding:0}}body{{background:#0a0a0a;width:{size}px;height:{size}px;display:flex;align-items:center;justify-content:center}}svg{{width:{int(size*0.78)}px;height:{int(size*0.78)}px}}</style>
</head><body>{icon_svg}</body></html>"""
        from scripts.pipeline import render_html_string
        await render_html_string(page, html, FAVICONS_DIR / fname, size, size)
        print(f"  -> {fname}")
```

Remove the Pillow-based `generate_favicons()` function. Remove the `shutil.copy(icon_out, favicon_src)` trick — `icon-512.png` is now rendered natively.

- [ ] **Step 3: Run**

```bash
python scripts/generate.py
pytest tests/test_generate.py -v
```
Expected: all green, favicons visibly sharper (eyeball check on `favicon-32.png`).

- [ ] **Step 4: Commit**

```bash
git add scripts/generate.py tests/test_generate.py
git commit -m "feat(favicons): render natively from SVG at target resolution"
```

---

## Task 8: Unified CLI — `scripts/build.py`

**Files:**
- Create: `scripts/build.py`
- Create: `tests/test_build_cli.py`

- [ ] **Step 1: Write failing test**

`tests/test_build_cli.py`:
```python
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent

def test_build_cli_help_lists_flags():
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "build.py"), "--help"],
        capture_output=True, text=True, timeout=10,
    )
    assert result.returncode == 0
    assert "--brand" in result.stdout
    assert "--ads" in result.stdout
    assert "--all" in result.stdout
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Create `scripts/build.py`**

```python
"""
Unified Vibe Web asset pipeline.

Usage:
    python scripts/build.py --all        # brand + ads
    python scripts/build.py --brand      # logos, social, favicons
    python scripts/build.py --ads        # ad creatives only
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def main() -> int:
    parser = argparse.ArgumentParser(description="Vibe Web asset pipeline")
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--brand", action="store_true", help="Generate brand pack (logos, social, favicons)")
    g.add_argument("--ads", action="store_true", help="Render ad creatives")
    g.add_argument("--all", action="store_true", help="Run the full pipeline")
    args = parser.parse_args()

    if args.brand or args.all:
        from scripts.generate import main as gen_main
        asyncio.run(gen_main())
    if args.ads or args.all:
        from ads.render import main as ads_main
        asyncio.run(ads_main())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run — expect PASS**

Run: `pytest tests/test_build_cli.py -v`

- [ ] **Step 5: Smoke-test real execution**

Run: `python scripts/build.py --all`
Expected: both pipelines complete, 21 PNGs updated.

- [ ] **Step 6: Commit**

```bash
git add scripts/build.py tests/test_build_cli.py
git commit -m "feat(cli): add unified build.py with --brand/--ads/--all"
```

---

## Task 9: Visual Regression Tests

**Files:**
- Create: `tests/goldens/ad-portfolio-grid.png` (copy of current render)
- Create: `tests/goldens/social-instagram-post.png`
- Create: `tests/goldens/logo-primary.png`
- Create: `tests/test_visual_regression.py`

- [ ] **Step 1: Capture golden images from current good renders**

```bash
mkdir -p tests/goldens
cp ads/renders/01-portfolio-grid.png tests/goldens/ad-portfolio-grid.png
cp brand/social/renders/instagram-post.png tests/goldens/social-instagram-post.png
cp brand/logos/vibeweb-primary.png tests/goldens/logo-primary.png
```

- [ ] **Step 2: Write test — tolerance-based perceptual diff**

`tests/test_visual_regression.py`:
```python
"""
Visual regression — compare current renders against goldens.

Tolerance: allows minor anti-aliasing drift (<=0.5% of pixels differing
by a Manhattan distance > 20) but catches layout/color breaks.
"""
from pathlib import Path
import pytest
from PIL import Image, ImageChops

ROOT = Path(__file__).parent.parent
GOLDENS = Path(__file__).parent / "goldens"

CASES = [
    (ROOT / "ads" / "renders" / "01-portfolio-grid.png", GOLDENS / "ad-portfolio-grid.png"),
    (ROOT / "brand" / "social" / "renders" / "instagram-post.png", GOLDENS / "social-instagram-post.png"),
    (ROOT / "brand" / "logos" / "vibeweb-primary.png", GOLDENS / "logo-primary.png"),
]

PIXEL_DIFF_THRESHOLD = 20       # Manhattan distance per channel
ALLOWED_DIFF_FRACTION = 0.005   # 0.5% of pixels may exceed threshold


def _fraction_diff(a: Image.Image, b: Image.Image) -> float:
    a = a.convert("RGB")
    b = b.convert("RGB")
    assert a.size == b.size, f"size mismatch: {a.size} vs {b.size}"
    diff = ImageChops.difference(a, b)
    over = 0
    total = a.size[0] * a.size[1]
    for px in diff.getdata():
        if sum(px) > PIXEL_DIFF_THRESHOLD:
            over += 1
    return over / total


@pytest.mark.visual
@pytest.mark.parametrize("current,golden", CASES, ids=lambda p: p.name if hasattr(p, "name") else str(p))
def test_render_matches_golden(current, golden):
    if not current.exists():
        pytest.skip(f"Render missing — run the pipeline first: {current}")
    if not golden.exists():
        pytest.skip(f"Golden missing: {golden}")
    frac = _fraction_diff(Image.open(current), Image.open(golden))
    assert frac <= ALLOWED_DIFF_FRACTION, (
        f"Visual drift: {frac*100:.2f}% of pixels differ (>{PIXEL_DIFF_THRESHOLD}/channel), "
        f"max allowed {ALLOWED_DIFF_FRACTION*100:.2f}%. Update golden if intentional."
    )
```

- [ ] **Step 3: Run — expect PASS (goldens match current state)**

Run: `pytest tests/test_visual_regression.py -v -m visual`

- [ ] **Step 4: Sanity — break a template, confirm test fails, revert**

Temporarily change bg in `ads/templates/01-portfolio-grid.html` to red, re-render, run visual test → FAIL. Revert.

- [ ] **Step 5: Commit**

```bash
git add tests/goldens tests/test_visual_regression.py
git commit -m "test(visual): add perceptual golden-image regression for ad/social/logo"
```

---

## Task 10: Remove Orphan `vibeweb-logo-hd.png`

**Files:**
- Delete: `brand/logos/vibeweb-logo-hd.png`
- Modify: `tests/test_generate.py` (confirm absent)

`vibeweb-logo-hd.png` is not produced by `generate.py`, not in `EXPECTED_OUTPUTS`, not referenced anywhere.

- [ ] **Step 1: Confirm it's a true orphan — grep for references**

Run: `grep -r "vibeweb-logo-hd" .` → expected: no references outside git internals.

- [ ] **Step 2: Delete the file**

```bash
git rm brand/logos/vibeweb-logo-hd.png
```

- [ ] **Step 3: Add guard test**

`tests/test_generate.py` (append):
```python
def test_no_orphan_logo_files():
    """Every PNG in brand/logos/ must be produced by generate.py (listed in EXPECTED_OUTPUTS)."""
    produced = {p.name for p in (BASE / "logos").glob("*.png")}
    expected_in_logos = {
        Path(rel).name for rel, _, _ in EXPECTED_OUTPUTS if rel.startswith("logos/")
    }
    orphans = produced - expected_in_logos
    assert not orphans, f"Orphan PNGs in brand/logos/: {orphans}"
```

- [ ] **Step 4: Run — expect PASS**

Run: `pytest tests/test_generate.py -v`

- [ ] **Step 5: Commit**

```bash
git add tests/test_generate.py
git commit -m "chore(brand): remove orphan vibeweb-logo-hd.png + add guard test"
```

---

## Task 11: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite README with post-refactor reality**

Required updates:
- Install via `pip install -e ".[dev]"` instead of free-form pip list.
- Single command: `python scripts/build.py --all` replaces separate `python scripts/generate.py` + `python ads/render.py`.
- Tokens section: state that `var(--*)` is mandatory in templates (tokens.css as real source of truth), enforced by `test_tokens_truth.py`.
- Tests section: mention 3 test layers — structural, tokens-truth, visual regression.
- Remove the `#0a0a0a (not #0d0d0d — legacy will be migrated)` note (migration is now complete).

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for unified pipeline and tokens-as-truth"
```

---

## Task 12: Final Verification

- [ ] **Step 1: Clean state — remove all generated PNGs**

```bash
rm -rf ads/renders/*.png brand/social/renders/*.png brand/favicons/*.png
rm -f brand/logos/vibeweb-primary.png brand/logos/vibeweb-icon.png
```

- [ ] **Step 2: Full rebuild from scratch**

```bash
python scripts/build.py --all
```

Expected: 21 PNGs produced, no warnings.

- [ ] **Step 3: Full test suite**

```bash
pytest -v
```

Expected counts:
- Packaging: 3
- Pipeline unit: 3
- Tokens truth: ~34 (11 templates × 3 tests + tokens/SVG)
- Generate structural: 42 (preserved)
- Generate integration: 30 (preserved)
- Favicon detail: 3 (new)
- Build CLI: 1
- Visual regression: 3
- Ad render structural: 8 (preserved)

Target: ~125+ tests, all green.

- [ ] **Step 4: Lint via `python -m compileall`**

```bash
python -m compileall scripts/ ads/ tests/
```
Expected: no SyntaxError.

- [ ] **Step 5: Final commit if anything lingered**

```bash
git status
# should be clean
```

---

## Review Gate

After Task 12 passes:
1. Invoke `pr-review-toolkit:review-pr` against the diff from main.
2. Address any flags before declaring DONE.
3. Write state file: `status: COMPLETED`.
