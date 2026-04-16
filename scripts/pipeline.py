"""
Helpers compartilhados dos pipelines Playwright do Vibe Web.

Usado por scripts/generate.py (brand) e ads/render.py (ads).
Garante carregamento determinístico de fontes via document.fonts.ready.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import AsyncIterator

FONT_READY_SCRIPT = "document.fonts.ready"


def to_file_url(path: Path) -> str:
    """Converte path local em URL file:// (Windows-safe, escapa espacos)."""
    return path.resolve().as_uri()


@dataclass(frozen=True)
class RenderJob:
    source: Path
    out: Path
    width: int
    height: int
    query: str = ""


@asynccontextmanager
async def playwright_page() -> AsyncIterator:
    """Abre uma page chromium em context manager."""
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        try:
            page = await browser.new_page()
            yield page
        finally:
            await browser.close()


async def wait_for_fonts(page) -> None:
    """Sinal deterministico de fontes carregadas."""
    await page.evaluate(FONT_READY_SCRIPT)


async def render_job(page, job: RenderJob) -> None:
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
    await page.set_viewport_size({"width": width, "height": height})
    await page.set_content(html)
    await page.wait_for_load_state("networkidle")
    await wait_for_fonts(page)
    out.parent.mkdir(parents=True, exist_ok=True)
    await page.screenshot(
        path=str(out),
        clip={"x": 0, "y": 0, "width": width, "height": height},
    )


async def run_jobs(jobs: list[RenderJob]) -> None:
    async with playwright_page() as page:
        for job in jobs:
            await render_job(page, job)
