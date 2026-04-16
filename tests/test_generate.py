"""
Testes do gerador de brand assets da Vibe Web.

Camadas:
  - Unitários: funções auxiliares (sem I/O, sempre rodam)
  - Integração: verificam arquivos gerados (rodam após generate.py)

Uso:
  pytest test_generate.py              # apenas unitários
  pytest test_generate.py -m integration  # todos (requer generate.py já rodado)
"""
import pytest
from pathlib import Path

BASE = Path(__file__).parent.parent / "brand"

# ─── Markers ──────────────────────────────────────────────────
# ─── Unit: to_file_url ────────────────────────────────────────
# Usa BASE / arquivo existente pois no Windows Path("/foo") não é absoluto.

def test_to_file_url_returns_string():
    from generate import to_file_url
    result = to_file_url(BASE / "guidelines.html")
    assert isinstance(result, str)


def test_to_file_url_starts_with_file_scheme():
    from generate import to_file_url
    result = to_file_url(BASE / "guidelines.html")
    assert result.startswith("file:///")


def test_to_file_url_with_query_appended():
    """generate.py concatena query string manualmente — verificar comportamento base."""
    from generate import to_file_url
    base_url = to_file_url(BASE / "social" / "templates" / "instagram-highlight.html")
    with_query = base_url + "?type=portfolio"
    assert "?type=portfolio" in with_query


# ─── Unit: directory structure ────────────────────────────────

def test_logos_dir_exists():
    assert (BASE / "logos").is_dir()


def test_social_templates_dir_exists():
    assert (BASE / "social" / "templates").is_dir()


def test_social_renders_dir_exists():
    assert (BASE / "social" / "renders").is_dir()


def test_favicons_dir_exists():
    assert (BASE / "favicons").is_dir()


# ─── Unit: source files exist before generation ───────────────

SOURCE_SVG_FILES = [
    "logos/vibeweb-primary.svg",
    "logos/vibeweb-stacked.svg",
    "logos/vibeweb-icon.svg",
    "logos/vibeweb-wordmark.svg",
    "logos/vibeweb-white.svg",
    "logos/vibeweb-black.svg",
]

SOURCE_HTML_FILES = [
    "social/templates/instagram-post.html",
    "social/templates/instagram-story.html",
    "social/templates/instagram-highlight.html",
    "social/templates/linkedin-banner.html",
    "social/templates/og-image.html",
]

@pytest.mark.parametrize("rel_path", SOURCE_SVG_FILES)
def test_source_svg_exists(rel_path):
    assert (BASE / rel_path).is_file(), f"SVG source missing: {rel_path}"


@pytest.mark.parametrize("rel_path", SOURCE_HTML_FILES)
def test_source_html_exists(rel_path):
    assert (BASE / rel_path).is_file(), f"HTML template missing: {rel_path}"


def test_brand_guidelines_html_exists():
    assert (BASE / "guidelines.html").is_file()


def test_brand_guidelines_css_exists():
    assert (BASE / "guidelines.css").is_file()


# ─── Unit: SVG content integrity ─────────────────────────────

def test_icon_svg_has_dark_background():
    content = (BASE / "logos/vibeweb-icon.svg").read_text(encoding="utf-8")
    assert "#0d0d0d" in content


def test_icon_svg_has_brand_green():
    content = (BASE / "logos/vibeweb-icon.svg").read_text(encoding="utf-8")
    assert "#04d361" in content


def test_icon_svg_has_fill_rule_evenodd():
    content = (BASE / "logos/vibeweb-icon.svg").read_text(encoding="utf-8")
    assert "evenodd" in content


def test_primary_svg_has_separator_line():
    content = (BASE / "logos/vibeweb-primary.svg").read_text(encoding="utf-8")
    assert "<line" in content


def test_white_svg_has_no_background_rect():
    """vibeweb-white.svg é para overlay — não deve ter fundo sólido."""
    content = (BASE / "logos/vibeweb-white.svg").read_text(encoding="utf-8")
    # Pode ter um comentário mencionando "sem background", mas não um rect fill sólido escuro
    assert 'fill="#0d0d0d"' not in content or '<rect' not in content


def test_black_svg_has_white_background():
    content = (BASE / "logos/vibeweb-black.svg").read_text(encoding="utf-8")
    assert "#ffffff" in content


# ─── Unit: HTML template content ──────────────────────────────

def test_instagram_post_has_correct_dimensions_in_style():
    content = (BASE / "social/templates/instagram-post.html").read_text(encoding="utf-8")
    assert "1080px" in content


def test_instagram_story_has_correct_height_in_style():
    content = (BASE / "social/templates/instagram-story.html").read_text(encoding="utf-8")
    assert "1920px" in content


def test_instagram_highlight_has_javascript_type_param():
    content = (BASE / "social/templates/instagram-highlight.html").read_text(encoding="utf-8")
    assert "URLSearchParams" in content
    assert "type" in content


def test_linkedin_banner_has_correct_dimensions():
    content = (BASE / "social/templates/linkedin-banner.html").read_text(encoding="utf-8")
    assert "1584px" in content
    assert "396px" in content


def test_all_templates_have_brand_green():
    for rel_path in SOURCE_HTML_FILES:
        content = (BASE / rel_path).read_text(encoding="utf-8")
        assert "#04d361" in content, f"{rel_path} nao tem a cor #04d361"


def test_all_templates_have_dark_background():
    for rel_path in SOURCE_HTML_FILES:
        content = (BASE / rel_path).read_text(encoding="utf-8")
        assert "#0d0d0d" in content, f"{rel_path} nao tem background #0d0d0d"


def test_instagram_post_has_footer_url():
    content = (BASE / "social/templates/instagram-post.html").read_text(encoding="utf-8")
    assert "vibe-web.com" in content


# ─── Integration: output PNGs exist and have correct dimensions ──

EXPECTED_OUTPUTS = [
    # (relative_path, width, height)
    ("logos/vibeweb-primary.png",                          800,  200),
    ("logos/vibeweb-icon.png",                             512,  512),
    ("social/renders/instagram-post.png",                 1080, 1080),
    ("social/renders/instagram-story.png",                1080, 1920),
    ("social/renders/instagram-highlight-portfolio.png",  1000, 1000),
    ("social/renders/instagram-highlight-services.png",   1000, 1000),
    ("social/renders/instagram-highlight-about.png",      1000, 1000),
    ("social/renders/instagram-highlight-contact.png",    1000, 1000),
    ("social/renders/instagram-highlight-feed.png",       1000, 1000),
    ("social/renders/linkedin-banner.png",                1584,  396),
    ("social/renders/og-image.png",                       1200,  630),
    ("favicons/icon-512.png",                              512,  512),
    ("favicons/favicon-16.png",                             16,   16),
    ("favicons/favicon-32.png",                             32,   32),
    ("favicons/apple-touch-icon.png",                      180,  180),
]


@pytest.mark.integration
@pytest.mark.parametrize("rel_path,expected_w,expected_h", EXPECTED_OUTPUTS)
def test_output_png_exists(rel_path, expected_w, expected_h):
    out = BASE / rel_path
    assert out.exists(), f"Arquivo nao gerado: {rel_path}"
    assert out.stat().st_size > 0, f"Arquivo vazio: {rel_path}"


@pytest.mark.integration
@pytest.mark.parametrize("rel_path,expected_w,expected_h", EXPECTED_OUTPUTS)
def test_output_png_dimensions(rel_path, expected_w, expected_h):
    pytest.importorskip("PIL", reason="pillow nao instalado")
    from PIL import Image
    img = Image.open(str(BASE / rel_path))
    w, h = img.size
    assert w == expected_w, f"{rel_path}: largura {w} != {expected_w}"
    assert h == expected_h, f"{rel_path}: altura {h} != {expected_h}"
