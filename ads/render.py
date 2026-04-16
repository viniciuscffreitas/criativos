"""
Render Meta Ads creatives (1080x1080) from templates/*.html -> renders/*.png.

Uses scripts.pipeline for deterministic font loading (document.fonts.ready).
Legacy exports (to_file_url, SIZE, TEMPLATES_DIR, RENDERS_DIR) are kept for
ads/test_render.py backward compatibility.

Usage: python ads/render.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.pipeline import RenderJob, run_jobs, to_file_url as _to_file_url

ADS_DIR = Path(__file__).parent
TEMPLATES_DIR = ADS_DIR / "templates"
RENDERS_DIR = ADS_DIR / "renders"
SIZE = 1080


def to_file_url(path: Path) -> str:
    """Re-export for test_render.py backward compat."""
    return _to_file_url(path)


def build_jobs() -> list[RenderJob]:
    RENDERS_DIR.mkdir(exist_ok=True)
    return [
        RenderJob(source=tpl, out=RENDERS_DIR / f"{tpl.stem}.png", width=SIZE, height=SIZE)
        for tpl in sorted(TEMPLATES_DIR.glob("*.html"))
    ]


async def main():
    jobs = build_jobs()
    if not jobs:
        print(f"No templates found in {TEMPLATES_DIR}")
        return
    print(f"Rendering {len(jobs)} ad creative(s)...")
    await run_jobs(jobs)
    for job in jobs:
        print(f"  [OK] {job.out.name}")
    print(f"\nDone: {RENDERS_DIR.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())
