"""
Render Meta Ads creatives (1080x1080) from HTML templates in `templates/` -> PNG in `renders/`.

Usage: python render.py
Requires: pip install playwright && playwright install chromium
"""

import asyncio
from pathlib import Path

ADS_DIR = Path(__file__).parent
TEMPLATES_DIR = ADS_DIR / "templates"
RENDERS_DIR = ADS_DIR / "renders"
RENDERS_DIR.mkdir(exist_ok=True)

SIZE = 1080
FONT_LOAD_MS = 1500


def to_file_url(path: Path) -> str:
    return path.resolve().as_uri()


async def main():
    from playwright.async_api import async_playwright

    templates = sorted(TEMPLATES_DIR.glob("*.html"))
    if not templates:
        print(f"No templates found in {TEMPLATES_DIR}")
        return

    print(f"Rendering {len(templates)} creative(s)...\n")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page()
        await page.set_viewport_size({"width": SIZE, "height": SIZE})

        for html_path in templates:
            out_path = RENDERS_DIR / f"{html_path.stem}.png"
            await page.goto(to_file_url(html_path))
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(FONT_LOAD_MS)
            await page.screenshot(
                path=str(out_path),
                clip={"x": 0, "y": 0, "width": SIZE, "height": SIZE},
            )
            print(f"  [OK] {out_path.name}")

        await browser.close()

    rendered = list(RENDERS_DIR.glob("*.png"))
    print(f"\nDone: {len(rendered)} creatives in {RENDERS_DIR.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())
