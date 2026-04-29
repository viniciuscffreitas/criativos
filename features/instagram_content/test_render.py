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
# NOTE (CLAUDE.md §2.1): cross-feature import tolerated for v1 — tests/ is the
# legacy location and these constants will graduate to shared/visual_regression.py
# when a 3rd feature consumes them. Do NOT duplicate the constants here.
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
# Anchor with negative lookbehind so margin-top/padding-top/border-top are NOT
# matched as positioning declarations.
TOP_DECL = re.compile(r"(?<![\w-])top\s*:\s*(\d+)\s*px", re.IGNORECASE)
BOTTOM_DECL = re.compile(r"(?<![\w-])bottom\s*:\s*(\d+)\s*px", re.IGNORECASE)


def _all_templates() -> list[Path]:
    """Templates list for parametrize. Used by tokens-truth-style content tests."""
    return sorted(TEMPLATES_DIR.glob("*.html"))


def _all_style_sources() -> list[Path]:
    """HTML + sibling CSS files. Carousels split CSS to a sibling file (file-size
    rule); the static safe-zone lint must read both or it covers nothing for them.
    """
    return sorted(list(TEMPLATES_DIR.glob("*.html")) + list(TEMPLATES_DIR.glob("*.css")))


def _all_renders() -> list[tuple[Path, int, int]]:
    """(out_path, width, height) per RenderJob."""
    return [(j.out, j.width, j.height) for j in build_jobs()]


def _skip_or_fail_when_render_missing(render: Path) -> None:
    """Skip on full clean slate (local dev never ran build.py); FAIL on partial state.

    Partial state = some renders exist but this one doesn't. Indicates either an
    interrupted build or a regression — silently skipping would hide the bug
    (CI would pass on a half-empty pipeline).
    """
    if render.exists():
        return
    other_renders = list(RENDERS_DIR.glob("*.png")) if RENDERS_DIR.exists() else []
    if other_renders:
        pytest.fail(
            f"Render missing: {render.name} — partial pipeline state "
            f"({len(other_renders)} other renders exist). Re-run build.py "
            f"--instagram and check stdout for [FAIL] markers."
        )
    pytest.skip(f"Render missing: {render.name} — run build.py --instagram")


# ---------- Layer 1: dimensions ---------------------------------------------

@pytest.mark.parametrize(
    "render,width,height",
    _all_renders(),
    ids=[r[0].name for r in _all_renders()],
)
def test_dimensions_match(render, width, height):
    _skip_or_fail_when_render_missing(render)
    with Image.open(render) as im:
        assert im.size == (width, height), (
            f"{render.name}: expected {width}x{height}, got {im.size}"
        )


# ---------- Layer 2: safe-zone static lint ----------------------------------

@pytest.mark.parametrize(
    "src",
    _all_style_sources(),
    ids=lambda p: p.name,
)
def test_safe_zone_static(src):
    """Reject critical text positioned in top 60px or bottom 60px.

    Iterates over HTML AND sibling CSS files: the 3 carousels keep their
    rules in `<name>.css` (file-size split); without reading them this lint
    would silently pass on 78% of renders.
    """
    css = src.read_text(encoding="utf-8")
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
                f"{src.name}: selector '{selector.strip()}' has top: {m.group(1)}px "
                f"— must be >= {SAFE_ZONE_PX}px (3:4 grid crop)"
            )
        for m in BOTTOM_DECL.finditer(body):
            assert int(m.group(1)) >= SAFE_ZONE_PX, (
                f"{src.name}: selector '{selector.strip()}' has bottom: {m.group(1)}px "
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
    _skip_or_fail_when_render_missing(render)
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

# Job declaration contract tests live in test_jobs.py (architectural split:
# this file tests rendered output; test_jobs.py tests the job-list contract).
