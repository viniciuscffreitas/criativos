"""
Playwright e2e: full Setup → Generate → Review happy path in dry-run mode.

Opt-in: set VIBEWEB_E2E=1 to run. Without the env var the test is skipped so
the default pytest run stays fast.

Closed-loop verification per §2.5: asserts rendered DOM elements, not just
dimensions or existence of files. The Review-screen golden guards against
visual drift per the same principle.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(
    not os.getenv("VIBEWEB_E2E"),
    reason="opt-in e2e; set VIBEWEB_E2E=1",
)

pytest.importorskip("playwright.sync_api")

from playwright.sync_api import Page, expect  # noqa: E402

# Golden-image tolerance: identical to tests/test_visual_regression.py so the
# Review screen holds to the same bar as the ad renders.
_PIXEL_DIFF_THRESHOLD = 20       # R+G+B per-channel Manhattan sum
_ALLOWED_DIFF_FRACTION = 0.01    # 1% of pixels may exceed

_GOLDENS = Path(__file__).parent.parent.parent / "tests" / "goldens"
_REVIEW_GOLDEN = _GOLDENS / "web-gui-review-dryrun.png"


def _drive_to_review(page: Page, ui_server: str) -> None:
    """
    Runs the Setup → Generate → Review flow in dry-run mode and blocks until
    all 3 variant cards are visible. Used by both the flow test and the
    visual-regression test (DAMP §2.3 — second usage, shape stable).
    """
    page.goto(f"{ui_server}/ui/")
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_load_state("networkidle")
    # ⌘1 → flow (localStorage already cleared; default is 'flow' but be explicit)
    page.keyboard.press("Meta+1")
    expect(page.get_by_text("Novo fluxo").first).to_be_visible(timeout=10_000)
    page.get_by_role("button", name="Próximo").click()
    expect(page.locator('[data-testid="token-stream"]')).to_be_visible(timeout=8_000)
    variant_cards = page.locator('[data-testid="variant-card"]')
    expect(variant_cards).to_have_count(3, timeout=30_000)


@pytest.mark.e2e
def test_full_flow_dry_run(page: Page, ui_server: str) -> None:
    """
    Drives the full Setup → Generate → Review flow through the SSE stream in
    dry-run mode. Asserts each major UI milestone per the spec.
    """
    # 1. Load the app. Clear localStorage first so nav always starts at 'flow'.
    page.goto(f"{ui_server}/ui/")
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_load_state("networkidle")

    # 2. Sidebar shows the active project name (fetched async; 10s covers slow CI).
    # Appears in both the project switcher div and the recent-projects span — use first.
    expect(page.get_by_text("Vibe Web").first).to_be_visible(timeout=10_000)

    # 3. ⌘2 → Gallery — at least 6 creative cards.
    page.keyboard.press("Meta+2")
    creative_cards = page.locator('[data-testid="creative-card"]')
    expect(creative_cards).to_have_count(6, timeout=10_000)

    # 4. Click first card → detail panel slides in.
    creative_cards.first.click()
    expect(page.locator('[data-testid="detail-panel"]')).to_be_visible()

    # 5. Escape closes detail panel; ⌘1 → flow view.
    page.keyboard.press("Escape")
    page.keyboard.press("Meta+1")
    expect(page.get_by_text("Novo fluxo").first).to_be_visible()

    # 6. Click "Próximo" in Setup — saves brief and advances to Generate.
    page.get_by_role("button", name="Próximo").click()

    # 7. Token stream panel is visible (SSE started).
    expect(page.locator('[data-testid="token-stream"]')).to_be_visible(timeout=8_000)

    # 8. After stream completes FlowView auto-advances to Review.
    #    Wait for 3 variant cards (n_variants default = 3). 30s covers slow CI.
    variant_cards = page.locator('[data-testid="variant-card"]')
    expect(variant_cards).to_have_count(3, timeout=30_000)

    # 9. At least one confidence badge (✅ / ⚠️ / 🔴) must be visible.
    badges = page.locator('[data-testid="variant-card"] [title^="confidence:"]')
    expect(badges.first).to_be_visible()


@pytest.mark.e2e
@pytest.mark.visual
def test_review_screen_matches_golden(page: Page, ui_server: str, tmp_path: Path) -> None:
    """
    Screenshots the Review screen after a full dry-run generation and
    compares against tests/goldens/web-gui-review-dryrun.png.

    First-run bootstrap: if the golden is absent, the screenshot is written
    to tmp_path and the test skips with a verbose message pointing to it.
    Reviewer copies it into goldens/ after visual inspection and commits.
    """
    _drive_to_review(page, ui_server)

    # Let the variants strip settle — animations/hover states add pixel noise.
    page.wait_for_load_state("networkidle")
    page.locator('[data-testid="review-screen"]').wait_for(state="visible")

    # Always shoot to tmp_path for the assertion. On first run, also write
    # a persistent copy next to the repo so the reviewer can inspect+copy it
    # without chasing pytest's ephemeral tmp dir.
    current = tmp_path / "review.png"
    page.locator('[data-testid="review-screen"]').screenshot(path=str(current))

    if not _REVIEW_GOLDEN.exists():
        bootstrap_dir = Path(__file__).parent / ".golden-bootstrap"
        bootstrap_dir.mkdir(exist_ok=True)
        bootstrap_path = bootstrap_dir / "review.png"
        page.locator('[data-testid="review-screen"]').screenshot(path=str(bootstrap_path))
        pytest.skip(
            f"Golden missing. Inspect {bootstrap_path} and, if correct, run:\n"
            f"  cp {bootstrap_path} {_REVIEW_GOLDEN}\n"
            f"  git add {_REVIEW_GOLDEN}"
        )

    frac = _fraction_diff(current, _REVIEW_GOLDEN)
    assert frac <= _ALLOWED_DIFF_FRACTION, (
        f"Review-screen drift {frac*100:.2f}% > {_ALLOWED_DIFF_FRACTION*100:.2f}%. "
        f"Diff is intentional? Update the golden:\n"
        f"  cp {current} {_REVIEW_GOLDEN}"
    )


def _fraction_diff(current_path: Path, golden_path: Path) -> float:
    """
    Fraction of pixels whose R+G+B Manhattan distance exceeds the threshold.
    Copied (not imported) from tests/test_visual_regression.py — the shared
    suite is intentionally independent of web_gui internals (§2.3 DAMP: 2nd
    use is fine to duplicate; extract on 3rd).
    """
    from PIL import Image, ImageChops

    a = Image.open(current_path).convert("RGB")
    b = Image.open(golden_path).convert("RGB")
    if a.size != b.size:
        raise AssertionError(
            f"Review screenshot size {a.size} != golden {b.size}. "
            f"Layout changed fundamentally — regenerate the golden."
        )
    data = ImageChops.difference(a, b).tobytes()
    total = a.size[0] * a.size[1]
    over = sum(
        1 for i in range(0, len(data), 3)
        if data[i] + data[i + 1] + data[i + 2] > _PIXEL_DIFF_THRESHOLD
    )
    return over / total
