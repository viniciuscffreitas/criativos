#!/usr/bin/env python3
"""
Vibe Web Brand Pack — Gerador de assets PNG
Uso: python generate.py
Requer: playwright (pip install playwright && playwright install chromium)
        pillow   (pip install pillow)
"""
import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE = Path(__file__).parent.parent / "brand"
LOGOS_DIR   = BASE / "logos"
SOCIAL_DIR  = BASE / "social"
RENDERS_DIR = SOCIAL_DIR / "renders"
FAVICONS_DIR = BASE / "favicons"


# ─── Helpers ──────────────────────────────────────────────────

def to_file_url(path: Path) -> str:
    return path.as_uri()


async def screenshot_html(page, html_path: Path, out_path: Path, width: int, height: int):
    await page.set_viewport_size({"width": width, "height": height})
    await page.goto(to_file_url(html_path))
    # Wait for fonts to load
    await page.wait_for_load_state("networkidle")
    await page.screenshot(path=str(out_path), clip={"x": 0, "y": 0, "width": width, "height": height})
    print(f"  -> {out_path.name}")


async def screenshot_html_with_query(page, html_path: Path, out_path: Path, width: int, height: int, query: str = ""):
    await page.set_viewport_size({"width": width, "height": height})
    url = to_file_url(html_path)
    if query:
        url += query
    await page.goto(url)
    await page.wait_for_load_state("networkidle")
    await page.screenshot(path=str(out_path), clip={"x": 0, "y": 0, "width": width, "height": height})
    print(f"  -> {out_path.name}")


async def render_svg_logo(page, svg_path: Path, out_path: Path, width: int, height: int):
    """Render an SVG file by embedding it in a minimal HTML wrapper."""
    svg_content = svg_path.read_text(encoding="utf-8")
    # Wrap in HTML so Google Fonts @import can load
    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&display=swap" rel="stylesheet">
<style>*{{margin:0;padding:0}}body{{background:#0a0a0a;display:flex;align-items:center;justify-content:center;width:{width}px;height:{height}px}}</style>
</head><body>{svg_content}</body></html>"""
    await page.set_viewport_size({"width": width, "height": height})
    await page.set_content(html)
    await page.wait_for_load_state("networkidle")
    await page.screenshot(path=str(out_path), clip={"x": 0, "y": 0, "width": width, "height": height})
    print(f"  -> {out_path.name}")


# ─── Favicon generation via Pillow ────────────────────────────

def generate_favicons(src_512: Path):
    try:
        from PIL import Image
    except ImportError:
        print("  [SKIP] pillow nao encontrado — pip install pillow")
        return

    src = Image.open(str(src_512))
    sizes = {
        "favicon-16.png":       16,
        "favicon-32.png":       32,
        "apple-touch-icon.png": 180,
    }
    for fname, size in sizes.items():
        out = FAVICONS_DIR / fname
        src.resize((size, size), Image.LANCZOS).save(str(out))
        print(f"  -> {fname}")


# ─── Main ──────────────────────────────────────────────────────

async def main():
    print("Vibe Web Brand Pack — Gerando assets...\n")

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # ── Task 1: Logo PNGs ─────────────────────────────────
        print("[1/4] Logos")

        # Primary logo: 800x200 (4:1 ratio to show horizontal layout)
        await render_svg_logo(
            page,
            LOGOS_DIR / "vibeweb-primary.svg",
            LOGOS_DIR / "vibeweb-primary.png",
            width=800, height=200
        )

        # Icon: 512x512 (square, tight crop)
        icon_html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>*{{margin:0;padding:0}}body{{background:#0a0a0a;width:512px;height:512px;display:flex;align-items:center;justify-content:center}}</style>
</head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="320" viewBox="-40 -70 680 680">
  <g fill="#04d361" fill-rule="evenodd">
    <path d="M 0.0,0.0 L 69.6,152.7 L 82.6,144.0 L 82.6,122.2 L 95.7,122.2 L 69.6,248.7 L 60.9,253.1 L 52.2,309.8 L 34.8,344.7 L 47.8,353.5 L 95.7,327.3 L 152.2,318.5 L 208.7,440.7 L 226.1,445.1 L 226.1,475.6 L 369.6,475.6 L 595.7,0.0 L 434.8,0.0 L 300.0,279.3 L 282.6,244.4 L 269.6,244.4 L 269.6,274.9 L 256.5,274.9 L 273.9,148.4 L 221.7,174.5 L 173.9,183.3 L 126.1,61.1 L 113.0,61.1 L 104.3,117.8 L 91.3,117.8 L 56.5,43.6 L 134.8,39.3 L 182.6,122.2 L 182.6,144.0 L 200.0,161.5 L 230.4,152.7 L 160.9,0.0 L 4.3,0.0 Z"/>
    <path d="M 460.9,43.6 L 313.0,353.5 L 300.0,366.5 L 282.6,353.5 L 252.2,279.3 L 226.1,440.7 L 234.8,414.5 L 252.2,432.0 L 343.5,432.0 L 352.2,423.3 L 369.6,366.5 L 534.8,48.0 L 465.2,43.6 Z"/>
    <path d="M 121.7,183.3 L 121.7,213.8 L 113.0,218.2 L 95.7,283.6 L 169.6,266.2 L 200.0,318.5 L 221.7,218.2 L 156.5,235.6 L 134.8,205.1 L 134.8,183.3 L 126.1,183.3 Z"/>
  </g>
</svg>
</body></html>"""
        await page.set_viewport_size({"width": 512, "height": 512})
        await page.set_content(icon_html)
        await page.wait_for_load_state("networkidle")
        icon_out = LOGOS_DIR / "vibeweb-icon.png"
        await page.screenshot(path=str(icon_out), clip={"x": 0, "y": 0, "width": 512, "height": 512})
        print(f"  -> vibeweb-icon.png")

        # ── Task 6 prep: favicon source 512x512 ──────────────
        favicon_src = FAVICONS_DIR / "icon-512.png"
        import shutil
        shutil.copy(str(icon_out), str(favicon_src))
        print(f"  -> favicons/icon-512.png (copy)")

        # ── Task 2: Instagram Post ────────────────────────────
        print("\n[2/4] Social templates")
        await screenshot_html(
            page,
            SOCIAL_DIR / "templates" / "instagram-post.html",
            RENDERS_DIR / "instagram-post.png",
            width=1080, height=1080
        )

        # ── Task 3: Instagram Story ───────────────────────────
        await screenshot_html(
            page,
            SOCIAL_DIR / "templates" / "instagram-story.html",
            RENDERS_DIR / "instagram-story.png",
            width=1080, height=1920
        )

        # ── Task 4: Highlight covers ──────────────────────────
        for highlight_type in ["portfolio", "services", "about", "contact", "feed"]:
            await screenshot_html_with_query(
                page,
                SOCIAL_DIR / "templates" / "instagram-highlight.html",
                RENDERS_DIR / f"instagram-highlight-{highlight_type}.png",
                width=1000, height=1000,
                query=f"?type={highlight_type}"
            )

        # ── Task 5: LinkedIn Banner + OG Image ────────────────
        await screenshot_html(
            page,
            SOCIAL_DIR / "templates" / "linkedin-banner.html",
            RENDERS_DIR / "linkedin-banner.png",
            width=1584, height=396
        )
        await screenshot_html(
            page,
            SOCIAL_DIR / "templates" / "og-image.html",
            RENDERS_DIR / "og-image.png",
            width=1200, height=630
        )

        await browser.close()

    # ── Task 6: Favicon resizes ───────────────────────────────
    print("\n[3/4] Favicons")
    generate_favicons(FAVICONS_DIR / "icon-512.png")

    # ── Summary ───────────────────────────────────────────────
    print("\n[4/4] Verificando outputs...")
    expected = [
        LOGOS_DIR / "vibeweb-primary.png",
        LOGOS_DIR / "vibeweb-icon.png",
        RENDERS_DIR / "instagram-post.png",
        RENDERS_DIR / "instagram-story.png",
        RENDERS_DIR / "instagram-highlight-portfolio.png",
        RENDERS_DIR / "instagram-highlight-services.png",
        RENDERS_DIR / "instagram-highlight-about.png",
        RENDERS_DIR / "instagram-highlight-contact.png",
        RENDERS_DIR / "instagram-highlight-feed.png",
        RENDERS_DIR / "linkedin-banner.png",
        RENDERS_DIR / "og-image.png",
        FAVICONS_DIR / "icon-512.png",
        FAVICONS_DIR / "favicon-16.png",
        FAVICONS_DIR / "favicon-32.png",
        FAVICONS_DIR / "apple-touch-icon.png",
    ]

    ok = 0
    fail = 0
    for f in expected:
        if f.exists() and f.stat().st_size > 0:
            ok += 1
        else:
            print(f"  [MISSING] {f.relative_to(BASE)}")
            fail += 1

    print(f"\nResultado: {ok}/{len(expected)} arquivos gerados")
    if fail:
        print(f"  {fail} arquivo(s) com erro — verifique acima")
        sys.exit(1)
    else:
        print("  Todos os assets gerados com sucesso!")
        print(f"\nAbra {BASE / 'guidelines.html'} no browser para ver o guia completo.")


if __name__ == "__main__":
    asyncio.run(main())
