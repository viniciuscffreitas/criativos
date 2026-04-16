#!/usr/bin/env python3
"""
Vibe Web Brand Pack — Gerador de assets PNG.

Uso:
    python scripts/generate.py

Consome scripts.pipeline para determinismo de fontes (document.fonts.ready)
e reuso de helpers (to_file_url, render_job, playwright_page).
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.pipeline import (  # noqa: E402
    RenderJob,
    playwright_page,
    render_html_string,
    render_job,
)

BASE = Path(__file__).parent.parent / "brand"
LOGOS_DIR = BASE / "logos"
SOCIAL_DIR = BASE / "social"
RENDERS_DIR = SOCIAL_DIR / "renders"
FAVICONS_DIR = BASE / "favicons"

HIGHLIGHT_TYPES = ("portfolio", "services", "about", "contact", "feed")

# Canonical bg for SVG wrapper HTML. Duplicated from brand/tokens.css:--bg
# because the wrapper is synthesized in Python and can't read the CSS file.
# If tokens.css changes, update here.
_BG = "#0a0a0a"

_FONTS_LINK = (
    '<link href="https://fonts.googleapis.com/css2?'
    'family=Syne:wght@700&display=swap" rel="stylesheet">'
)


def _wrap_svg(svg: str, width: int, height: int) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">{_FONTS_LINK}
<style>*{{margin:0;padding:0}}body{{background:{_BG};display:flex;align-items:center;justify-content:center;width:{width}px;height:{height}px}}</style>
</head><body>{svg}</body></html>"""


async def _render_logo(page, svg_path: Path, out: Path, width: int, height: int) -> None:
    svg = svg_path.read_text(encoding="utf-8")
    await render_html_string(page, _wrap_svg(svg, width, height), out, width, height)
    print(f"  -> {out.name}")


def _social_jobs() -> list[RenderJob]:
    RENDERS_DIR.mkdir(parents=True, exist_ok=True)
    tpl = SOCIAL_DIR / "templates"
    jobs = [
        RenderJob(tpl / "instagram-post.html", RENDERS_DIR / "instagram-post.png", 1080, 1080),
        RenderJob(tpl / "instagram-story.html", RENDERS_DIR / "instagram-story.png", 1080, 1920),
    ]
    for t in HIGHLIGHT_TYPES:
        jobs.append(
            RenderJob(
                tpl / "instagram-highlight.html",
                RENDERS_DIR / f"instagram-highlight-{t}.png",
                1000, 1000,
                query=f"?type={t}",
            )
        )
    jobs.extend([
        RenderJob(tpl / "linkedin-banner.html", RENDERS_DIR / "linkedin-banner.png", 1584, 396),
        RenderJob(tpl / "og-image.html", RENDERS_DIR / "og-image.png", 1200, 630),
    ])
    return jobs


async def _render_favicons_native(page) -> None:
    """Each favicon size is rendered directly from the SVG — raster downscale
    from 512 loses sub-pixel detail at 16/32.
    """
    icon_svg = (LOGOS_DIR / "vibeweb-icon.svg").read_text(encoding="utf-8")
    for fname, size in [
        ("favicon-16.png", 16),
        ("favicon-32.png", 32),
        ("apple-touch-icon.png", 180),
        ("icon-512.png", 512),
    ]:
        inner = max(int(size * 0.78), 12)
        html = (
            f"<!DOCTYPE html><html><head><meta charset='UTF-8'>"
            f"<style>*{{margin:0;padding:0}}"
            f"body{{background:{_BG};width:{size}px;height:{size}px;"
            f"display:flex;align-items:center;justify-content:center}}"
            f"svg{{width:{inner}px;height:{inner}px}}"
            f"</style></head><body>{icon_svg}</body></html>"
        )
        await render_html_string(page, html, FAVICONS_DIR / fname, size, size)
        print(f"  -> {fname}")


def _verify_outputs() -> int:
    expected = [
        LOGOS_DIR / "vibeweb-primary.png",
        LOGOS_DIR / "vibeweb-icon.png",
        RENDERS_DIR / "instagram-post.png",
        RENDERS_DIR / "instagram-story.png",
        *[RENDERS_DIR / f"instagram-highlight-{t}.png" for t in HIGHLIGHT_TYPES],
        RENDERS_DIR / "linkedin-banner.png",
        RENDERS_DIR / "og-image.png",
        FAVICONS_DIR / "icon-512.png",
        FAVICONS_DIR / "favicon-16.png",
        FAVICONS_DIR / "favicon-32.png",
        FAVICONS_DIR / "apple-touch-icon.png",
    ]
    missing = [f for f in expected if not (f.exists() and f.stat().st_size > 0)]
    for f in missing:
        print(f"  [MISSING] {f.relative_to(BASE)}")
    print(f"\nResultado: {len(expected) - len(missing)}/{len(expected)} arquivos gerados")
    return 1 if missing else 0


async def main() -> None:
    print("Vibe Web Brand Pack — Gerando assets...\n")
    FAVICONS_DIR.mkdir(parents=True, exist_ok=True)

    async with playwright_page() as page:
        print("[1/3] Logos")
        await _render_logo(page, LOGOS_DIR / "vibeweb-primary.svg", LOGOS_DIR / "vibeweb-primary.png", 800, 200)

        # Icon: read the SVG from disk — no more inline duplication.
        icon_svg = (LOGOS_DIR / "vibeweb-icon.svg").read_text(encoding="utf-8")
        icon_html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>*{{margin:0;padding:0}}body{{background:{_BG};width:512px;height:512px;display:flex;align-items:center;justify-content:center}}svg{{width:400px;height:320px}}</style>
</head><body>{icon_svg}</body></html>"""
        await render_html_string(page, icon_html, LOGOS_DIR / "vibeweb-icon.png", 512, 512)
        print("  -> vibeweb-icon.png")

        print("\n[2/3] Social templates")
        for job in _social_jobs():
            await render_job(page, job)
            print(f"  -> {job.out.name}")

        print("\n[3/3] Favicons (native render)")
        await _render_favicons_native(page)

    print("\nVerificando outputs...")
    rc = _verify_outputs()
    if rc:
        sys.exit(rc)
    print("  Todos os assets gerados com sucesso!")


if __name__ == "__main__":
    asyncio.run(main())
