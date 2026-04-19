"""
Playwright e2e: full Setup → Generate → Review happy path in dry-run mode.

Opt-in: set VIBEWEB_E2E=1 to run. Without the env var the test is skipped so
the default pytest run stays fast.

Closed-loop verification per §2.5: asserts rendered DOM elements, not just
dimensions or existence of files.
"""
from __future__ import annotations

import os

import pytest

pytestmark = pytest.mark.skipif(
    not os.getenv("VIBEWEB_E2E"),
    reason="opt-in e2e; set VIBEWEB_E2E=1",
)

pytest.importorskip("playwright.sync_api")

from playwright.sync_api import Page, expect  # noqa: E402


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
