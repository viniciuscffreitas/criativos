"""Helpers compartilhados do pipeline Playwright."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.pipeline import FONT_READY_SCRIPT, to_file_url


def test_to_file_url_returns_file_uri():
    url = to_file_url(Path(__file__))
    assert url.startswith("file:///")
    assert "test_pipeline" in url


def test_to_file_url_handles_spaces(tmp_path):
    p = tmp_path / "has spaces.html"
    p.write_text("x", encoding="utf-8")
    url = to_file_url(p)
    assert url.startswith("file:///")
    assert "%20" in url


def test_font_ready_script_awaits_document_fonts():
    assert "document.fonts.ready" in FONT_READY_SCRIPT
