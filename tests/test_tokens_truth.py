"""
Tokens.css como fonte de verdade real.

Regras:
- Todo template HTML (brand/social + ads) faz <link> para tokens.css.
- Templates usam var(--*) para cores-chave.
- Nenhum template contem o legado #0d0d0d.
- SVGs e tokens.css nao contem #0d0d0d.
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
