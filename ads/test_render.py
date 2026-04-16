"""
Structural tests for the ad render pipeline.

Fast checks that don't require running Playwright:
  - every template has a rendered PNG counterpart
  - every rendered PNG has the expected 1080x1080 dimensions
  - to_file_url returns a valid file:// URI

To run:  pytest ads/test_render.py
"""

import sys
from pathlib import Path

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from render import RENDERS_DIR, SIZE, TEMPLATES_DIR, to_file_url  # noqa: E402


def test_to_file_url_returns_file_uri():
    url = to_file_url(Path(__file__))
    assert url.startswith("file://")
    assert "test_render" in url


def test_templates_directory_populated():
    templates = list(TEMPLATES_DIR.glob("*.html"))
    assert len(templates) >= 6, f"expected >=6 templates, got {len(templates)}"


def test_every_template_has_a_render():
    template_stems = {p.stem for p in TEMPLATES_DIR.glob("*.html")}
    render_stems = {p.stem for p in RENDERS_DIR.glob("*.png")}
    missing = template_stems - render_stems
    assert not missing, f"templates without renders: {sorted(missing)}"


@pytest.mark.parametrize(
    "render_path",
    sorted(RENDERS_DIR.glob("*.png")) if RENDERS_DIR.exists() else [],
    ids=lambda p: p.name,
)
def test_render_is_square_at_expected_size(render_path):
    with Image.open(render_path) as img:
        assert img.size == (SIZE, SIZE), (
            f"{render_path.name} is {img.size}, expected ({SIZE}, {SIZE})"
        )
