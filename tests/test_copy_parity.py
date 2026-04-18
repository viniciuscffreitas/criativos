"""
Paridade numérica copy.md <-> ads/templates/*.html.

copy.md é o texto do Meta Ads Manager (primary text, headline, description).
Os templates são o criativo visual. Os TEXTOS não precisam ser idênticos —
mas os NÚMEROS canônicos sim. Se copy.md promete €450 e o PNG mostra €500,
é inconsistência material que engana o cliente.

Este teste vai desaparecer quando a Spec 1 consolidar copy em config/ads.yaml
— por enquanto, é a única barreira contra drift entre os dois pontos.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).parent.parent
COPY_MD = ROOT / "ads" / "copy.md"
TEMPLATES_DIR = ROOT / "ads" / "templates"

# Canônicos que precisam bater. "€3,000" vira "3,000"; "7 days" vira "7".
PRICE_RE = re.compile(r"€\s*([\d.,]+)")
DAYS_RE = re.compile(r"(\d+)\s*days?", re.IGNORECASE)


def _parse_copy_md() -> dict[str, dict[str, set[str]]]:
    """Map '01' -> {'prices': {...}, 'days': {...}} por section do copy.md."""
    text = COPY_MD.read_text(encoding="utf-8")
    parts = re.split(r"^## Ad (\d{2}) — ", text, flags=re.MULTILINE)
    # parts: ['preamble', '01', 'body01', '02', 'body02', ...]
    result: dict[str, dict[str, set[str]]] = {}
    for i in range(1, len(parts), 2):
        num = parts[i]
        body = parts[i + 1].split("\n---", 1)[0]
        result[num] = {
            "prices": {p.strip(".,") for p in PRICE_RE.findall(body)},
            "days": set(DAYS_RE.findall(body)),
        }
    return result


def _template_for(ad_num: str) -> Path:
    matches = sorted(TEMPLATES_DIR.glob(f"{ad_num}-*.html.j2"))
    assert matches, f"no template file matching {ad_num}-*.html"
    assert len(matches) == 1, f"expected exactly one template for {ad_num}, got {matches}"
    return matches[0]


_COPY = _parse_copy_md()
_AD_NUMS = sorted(_COPY.keys())


def test_copy_md_parses_all_six_ads():
    assert _AD_NUMS == ["01", "02", "03", "04", "05", "06"], (
        f"expected ads 01-06 in copy.md, got {_AD_NUMS}"
    )


@pytest.mark.parametrize("ad_num", _AD_NUMS)
def test_copy_has_canonical_numbers(ad_num):
    # Guard against the parser silently producing empty sets.
    entry = _COPY[ad_num]
    assert entry["prices"], f"copy.md Ad {ad_num}: no prices parsed"
    assert entry["days"], f"copy.md Ad {ad_num}: no durations parsed"


@pytest.mark.parametrize("ad_num", _AD_NUMS)
def test_template_price_matches_copy(ad_num):
    tpl = _template_for(ad_num)
    tpl_prices = {p.strip(".,") for p in PRICE_RE.findall(tpl.read_text(encoding="utf-8"))}
    copy_prices = _COPY[ad_num]["prices"]
    assert tpl_prices, f"{tpl.name}: no €-prices found — expected {copy_prices}"
    missing = copy_prices - tpl_prices
    assert not missing, (
        f"Ad {ad_num}: prices in copy.md missing from template {tpl.name}: "
        f"{sorted(missing)} (template has {sorted(tpl_prices)})"
    )


@pytest.mark.parametrize("ad_num", _AD_NUMS)
def test_template_duration_matches_copy(ad_num):
    tpl = _template_for(ad_num)
    tpl_days = set(DAYS_RE.findall(tpl.read_text(encoding="utf-8")))
    copy_days = _COPY[ad_num]["days"]
    assert tpl_days, f"{tpl.name}: no 'N days' found — expected {copy_days}"
    # Intersection >= 1: copy may mention an offer duration plus secondary
    # timeframes (e.g. "3 months of missed opportunities") — the primary
    # delivery window must appear in both.
    assert copy_days & tpl_days, (
        f"Ad {ad_num}: no shared duration between copy.md {sorted(copy_days)} "
        f"and template {tpl.name} {sorted(tpl_days)}"
    )


def test_every_template_is_referenced_by_copy_md():
    tpl_nums = {p.name[:2] for p in TEMPLATES_DIR.glob("[0-9][0-9]-*.html.j2")}
    copy_nums = set(_AD_NUMS)
    missing_in_copy = tpl_nums - copy_nums
    missing_tpl = copy_nums - tpl_nums
    assert not missing_in_copy, f"templates without copy.md section: {sorted(missing_in_copy)}"
    assert not missing_tpl, f"copy.md sections without template: {sorted(missing_tpl)}"
