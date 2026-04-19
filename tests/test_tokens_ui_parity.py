import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
TOKENS_CSS = ROOT / "brand" / "tokens.css"
TOKENS_TS = ROOT / "features" / "web_gui" / "ui" / "src" / "tokens.ts"


def _css_var(css: str, name: str) -> str:
    m = re.search(rf"--{name}\s*:\s*([^;]+);", css)
    assert m, f"tokens.css missing --{name}"
    return m.group(1).strip()


def _ts_prop(ts: str, name: str) -> str:
    m = re.search(rf"{name}:\s*'([^']+)'", ts)
    assert m, f"tokens.ts missing {name}"
    return m.group(1).strip()


def test_accent_matches():
    css = TOKENS_CSS.read_text(encoding="utf-8")
    ts = TOKENS_TS.read_text(encoding="utf-8")
    assert _css_var(css, "accent") == _ts_prop(ts, "accent")


def test_bg_matches():
    css = TOKENS_CSS.read_text(encoding="utf-8")
    ts = TOKENS_TS.read_text(encoding="utf-8")
    assert _css_var(css, "bg") == _ts_prop(ts, "bg")


def test_text_matches():
    css = TOKENS_CSS.read_text(encoding="utf-8")
    ts = TOKENS_TS.read_text(encoding="utf-8")
    assert _css_var(css, "text") == _ts_prop(ts, "text")


def test_text_muted_matches():
    css = TOKENS_CSS.read_text(encoding="utf-8")
    ts = TOKENS_TS.read_text(encoding="utf-8")
    assert _css_var(css, "text-muted") == _ts_prop(ts, "textMuted")


def test_border_matches():
    css = TOKENS_CSS.read_text(encoding="utf-8")
    ts = TOKENS_TS.read_text(encoding="utf-8")
    assert _css_var(css, "border") == _ts_prop(ts, "border")


def test_accent_rgb_matches():
    css = TOKENS_CSS.read_text(encoding="utf-8")
    ts = TOKENS_TS.read_text(encoding="utf-8")
    assert _css_var(css, "accent-rgb") == _ts_prop(ts, "accentRgb")
