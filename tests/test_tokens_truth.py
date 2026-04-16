"""
Tokens.css como fonte de verdade real.

Regras:
- Todo template HTML (brand/social + ads) faz <link> para tokens.css.
- Templates usam var(--*) para cores-chave em CSS.
- Nenhum template contem o legado #0d0d0d.
- SVGs e tokens.css nao contem #0d0d0d.
- CSS nao usa hex literais de cores tokenizadas (excluindo SVG fill/stroke attrs).
- CSS usa rgba(var(--accent-rgb), X) em vez de rgba(4,211,97,X).
"""
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).parent.parent

BRAND_TEMPLATES = sorted((ROOT / "brand" / "social" / "templates").glob("*.html"))
AD_TEMPLATES = sorted((ROOT / "ads" / "templates").glob("*.html"))
ALL_TEMPLATES = BRAND_TEMPLATES + AD_TEMPLATES

LEGACY_BG_PATTERN = re.compile(r"#0d0d0d", re.IGNORECASE)
TOKENS_IMPORT = re.compile(r'<link[^>]+href="[^"]*tokens\.css"', re.IGNORECASE)
VAR_USAGE = re.compile(r"var\(--[a-z][a-z0-9-]*\)")

# Cores canonizadas em tokens.css — proibidas como literal em CSS context.
TOKENIZED_HEX = {
    "#04d361": "var(--accent)",
    "#0a0a0a": "var(--bg)",
    "#ffffff": "var(--text)",
    "#a3a3a3": "var(--text-muted)",
    "#2a2a2a": "var(--border)",
}

_SVG_BLOCK = re.compile(r"<svg\b[^>]*>.*?</svg>", re.DOTALL | re.IGNORECASE)
_PRESENTATION_ATTR = re.compile(r'\s(?:fill|stroke|stop-color)="[^"]*"', re.IGNORECASE)
_ACCENT_RGBA = re.compile(r"rgba\(\s*4\s*,\s*211\s*,\s*97\s*,")


def _css_only(html: str) -> str:
    """Strip inline SVG blocks + presentation attributes — keep only CSS regions."""
    no_svg = _SVG_BLOCK.sub("", html)
    return _PRESENTATION_ATTR.sub("", no_svg)


@pytest.mark.parametrize("tpl", ALL_TEMPLATES, ids=lambda p: p.name)
def test_template_imports_tokens_css(tpl):
    content = tpl.read_text(encoding="utf-8")
    assert TOKENS_IMPORT.search(content), f"{tpl.name} must import brand/tokens.css"


@pytest.mark.parametrize("tpl", ALL_TEMPLATES, ids=lambda p: p.name)
def test_template_uses_var_for_core_colors(tpl):
    content = tpl.read_text(encoding="utf-8")
    assert VAR_USAGE.search(content), f"{tpl.name} must use var(--*) tokens"


@pytest.mark.parametrize("tpl", ALL_TEMPLATES, ids=lambda p: p.name)
def test_template_has_no_legacy_background(tpl):
    content = tpl.read_text(encoding="utf-8")
    assert not LEGACY_BG_PATTERN.search(content), (
        f"{tpl.name} contains legacy #0d0d0d — migrate to var(--bg) / #0a0a0a"
    )


def test_tokens_css_declares_canonical_bg():
    tokens = (ROOT / "brand" / "tokens.css").read_text(encoding="utf-8")
    assert "--bg:" in tokens
    assert "#0a0a0a" in tokens
    assert "#0d0d0d" not in tokens


def test_no_legacy_bg_in_svgs():
    svgs = list((ROOT / "brand" / "logos").glob("*.svg"))
    offenders = [s.name for s in svgs if LEGACY_BG_PATTERN.search(s.read_text(encoding="utf-8"))]
    assert not offenders, f"SVGs with legacy #0d0d0d: {offenders}"


@pytest.mark.parametrize("tpl", ALL_TEMPLATES, ids=lambda p: p.name)
def test_template_has_no_tokenized_hex_in_css(tpl):
    """CSS must reference tokens — no literal hex for colors that tokens.css owns."""
    css = _css_only(tpl.read_text(encoding="utf-8"))
    bad = {hex_: token for hex_, token in TOKENIZED_HEX.items()
           if re.search(re.escape(hex_), css, re.IGNORECASE)}
    assert not bad, (
        f"{tpl.name}: hardcoded hex in CSS context — replace with tokens: {bad}"
    )


@pytest.mark.parametrize("tpl", ALL_TEMPLATES, ids=lambda p: p.name)
def test_template_uses_accent_rgb_token_not_rgba_literal(tpl):
    """Brand green RGB must come from var(--accent-rgb), not literal rgba(4,211,97,X)."""
    css = _css_only(tpl.read_text(encoding="utf-8"))
    matches = _ACCENT_RGBA.findall(css)
    assert not matches, (
        f"{tpl.name}: {len(matches)} literal rgba(4,211,97,X) in CSS — "
        f"use rgba(var(--accent-rgb), X) instead"
    )


def test_tokens_css_exposes_accent_rgb_channel():
    tokens = (ROOT / "brand" / "tokens.css").read_text(encoding="utf-8")
    assert re.search(r"--accent-rgb\s*:", tokens), (
        "tokens.css must declare --accent-rgb (RGB channels of --accent)"
    )
