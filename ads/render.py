"""
Render Meta Ads creatives (1080x1080) from templates/*.html.j2 -> renders/*.png.

Flow:
  1. Load config/ads.yaml (copy + metadata per ad).
  2. For each .j2 template, render Jinja2 -> ads/.rendered/NN-slug.html.
  3. Playwright screenshots the rendered HTML at 1080x1080.

Uses scripts.pipeline for deterministic font loading (document.fonts.ready).
Legacy exports (to_file_url, SIZE, TEMPLATES_DIR, RENDERS_DIR) kept for
test back-compat.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader, StrictUndefined

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.pipeline import RenderJob, run_jobs, to_file_url as _to_file_url  # noqa: E402

ADS_DIR = Path(__file__).parent
TEMPLATES_DIR = ADS_DIR / "templates"
RENDERS_DIR = ADS_DIR / "renders"
RENDERED_HTML_DIR = ADS_DIR / ".rendered"
CONFIG_PATH = ADS_DIR.parent / "config" / "ads.yaml"
SIZE = 1080


def to_file_url(path: Path) -> str:
    """Re-export for test_render.py backward compat."""
    return _to_file_url(path)


def render_template_to_html(
    template_path: Path, copy: dict, out_dir: Path | None = None
) -> Path:
    """Render a .j2 template with copy={...} and write to out_dir/<stem>.html.

    out_dir defaults to ADS_DIR/.rendered/. Assets resolved via ../assets/
    (same grandparent as templates/ and .rendered/).
    """
    out_dir = out_dir or RENDERED_HTML_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    env = Environment(
        loader=FileSystemLoader(str(template_path.parent)),
        undefined=StrictUndefined,
        keep_trailing_newline=True,
    )
    template = env.get_template(template_path.name)
    html = template.render(copy=copy)

    # .html.j2 -> .html  |  .j2 -> (strip suffix)
    stem = template_path.name.removesuffix(".j2").removesuffix(".html") + ".html"
    out = out_dir / stem
    out.write_text(html, encoding="utf-8")
    return out


def _load_config() -> dict:
    return yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))


def build_jobs() -> list[RenderJob]:
    """Build RenderJob list from config + .j2 templates.

    Each ad entry in config/ads.yaml has an id ('01'..'06'). The template
    whose filename starts with that id is rendered with the entry's copy.
    """
    RENDERS_DIR.mkdir(exist_ok=True)
    config = _load_config()
    jobs: list[RenderJob] = []
    for ad_key, ad in config["ads"].items():
        tpl_matches = list(TEMPLATES_DIR.glob(f"{ad['id']}-*.html.j2"))
        if not tpl_matches:
            raise FileNotFoundError(
                f"No template matching {ad['id']}-*.html.j2 for ad '{ad_key}'"
            )
        if len(tpl_matches) > 1:
            raise RuntimeError(
                f"Multiple templates for ad '{ad_key}': {tpl_matches}"
            )
        rendered = render_template_to_html(tpl_matches[0], ad["copy"])
        jobs.append(
            RenderJob(
                source=rendered,
                out=RENDERS_DIR / f"{rendered.stem}.png",
                width=SIZE,
                height=SIZE,
            )
        )
    return jobs


async def main():
    jobs = build_jobs()
    if not jobs:
        print(f"No ads in {CONFIG_PATH}")
        return
    print(f"Rendering {len(jobs)} ad creative(s) via Jinja2 + Playwright...")
    await run_jobs(jobs)
    for job in jobs:
        print(f"  [OK] {job.out.name}")
    print(f"\nDone: {RENDERS_DIR.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())
