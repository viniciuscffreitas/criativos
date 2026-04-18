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


def _collect_renders() -> list[Path]:
    """Collected at import time — empty list = integration gate fails loud."""
    if not RENDERS_DIR.exists():
        return []
    return sorted(RENDERS_DIR.glob("*.png"))


_RENDERS = _collect_renders()


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


@pytest.mark.integration
def test_renders_dir_not_empty():
    # Without this gate, parametrize below receives [] when RENDERS_DIR is
    # empty -> 0 cases collected -> "passes" silently.
    assert RENDERS_DIR.exists(), (
        f"Renders dir missing: {RENDERS_DIR} — run `python ads/render.py`"
    )
    assert _RENDERS, (
        f"No PNGs in {RENDERS_DIR} — run `python ads/render.py` before integration tests"
    )


@pytest.mark.integration
@pytest.mark.parametrize(
    "render_path",
    _RENDERS,
    ids=lambda p: p.name,
)
def test_render_is_square_at_expected_size(render_path):
    with Image.open(render_path) as img:
        assert img.size == (SIZE, SIZE), (
            f"{render_path.name} is {img.size}, expected ({SIZE}, {SIZE})"
        )


def test_jinja_render_produces_html_file(tmp_path):
    """Given a minimal .j2 + config entry, the renderer writes HTML that Jinja evaluated."""
    from render import render_template_to_html

    tpl = tmp_path / "t.html.j2"
    tpl.write_text("<p>{{ copy.msg }}</p>", encoding="utf-8")
    out = render_template_to_html(tpl, {"msg": "hello"}, out_dir=tmp_path)

    assert out.exists()
    assert out.read_text(encoding="utf-8") == "<p>hello</p>"
