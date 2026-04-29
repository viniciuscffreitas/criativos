"""
Paridade numérica copy.md <-> config/ads.yaml (source of truth for visual copy).

copy.md é Meta Ads Manager (primary text, headline, description).
config/ads.yaml é o que aparece no PNG. Os números canônicos (preços, prazos)
devem bater entre os dois para não enganar o cliente.

Após a migração Spec 1 Task 5, os templates são Jinja2 puro — não contêm
literais como €450. A fonte canónica de copy visual é config/ads.yaml (copy.*).
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).parent.parent
COPY_MD = ROOT / "ads" / "copy.md"
ADS_YAML = ROOT / "config" / "ads.yaml"

PRICE_RE = re.compile(r"€\s*([\d.,]+)")
DAYS_RE = re.compile(r"(\d+)\s*days?", re.IGNORECASE)


def _parse_copy_md() -> dict[str, dict[str, set[str]]]:
    """Map '01' -> {'prices': {...}, 'days': {...}} per section in copy.md."""
    text = COPY_MD.read_text(encoding="utf-8")
    parts = re.split(r"^## Ad (\d{2}) — ", text, flags=re.MULTILINE)
    result: dict[str, dict[str, set[str]]] = {}
    for i in range(1, len(parts), 2):
        num = parts[i]
        body = parts[i + 1].split("\n---", 1)[0]
        result[num] = {
            "prices": {p.strip(".,") for p in PRICE_RE.findall(body)},
            "days": set(DAYS_RE.findall(body)),
        }
    return result


def _yaml_copy_concat(ad_entry: dict) -> str:
    """All string values under copy.* concatenated — ground truth for visual copy."""
    parts = []
    for v in ad_entry.get("copy", {}).values():
        if isinstance(v, str):
            parts.append(v)
    return " ".join(parts)


def _yaml_by_id() -> dict[str, dict]:
    """Index ads.yaml by the 2-digit `id` field."""
    data = yaml.safe_load(ADS_YAML.read_text(encoding="utf-8"))
    return {ad["id"]: ad for ad in data["ads"].values()}


_COPY = _parse_copy_md()
_YAML = _yaml_by_id()
_AD_NUMS = sorted(_COPY.keys())


def test_copy_md_parses_all_six_ads():
    assert _AD_NUMS == ["01", "02", "03", "04", "05", "06"], (
        f"expected ads 01-06 in copy.md, got {_AD_NUMS}"
    )


def test_every_copy_md_section_has_yaml_entry():
    missing = [n for n in _AD_NUMS if n not in _YAML]
    assert not missing, f"copy.md sections without ads.yaml id: {missing}"


@pytest.mark.parametrize("ad_num", _AD_NUMS)
def test_copy_has_canonical_numbers(ad_num):
    entry = _COPY[ad_num]
    assert entry["prices"], f"copy.md Ad {ad_num}: no prices parsed"
    assert entry["days"], f"copy.md Ad {ad_num}: no durations parsed"


@pytest.mark.parametrize("ad_num", _AD_NUMS)
def test_yaml_prices_match_copy(ad_num):
    yaml_text = _yaml_copy_concat(_YAML[ad_num])
    yaml_prices = {p.strip(".,") for p in PRICE_RE.findall(yaml_text)}
    copy_prices = _COPY[ad_num]["prices"]
    assert yaml_prices, f"Ad {ad_num}: no €-prices in ads.yaml copy block — expected {copy_prices}"
    missing = copy_prices - yaml_prices
    assert not missing, (
        f"Ad {ad_num}: prices in copy.md missing from ads.yaml copy: "
        f"{sorted(missing)} (yaml has {sorted(yaml_prices)})"
    )


@pytest.mark.parametrize("ad_num", _AD_NUMS)
def test_yaml_duration_matches_copy(ad_num):
    yaml_text = _yaml_copy_concat(_YAML[ad_num])
    yaml_days = set(DAYS_RE.findall(yaml_text))
    copy_days = _COPY[ad_num]["days"]
    assert yaml_days, f"Ad {ad_num}: no 'N days' in ads.yaml copy block — expected {copy_days}"
    assert copy_days & yaml_days, (
        f"Ad {ad_num}: no shared duration between copy.md {sorted(copy_days)} "
        f"and ads.yaml copy {sorted(yaml_days)}"
    )


def test_every_template_is_referenced_by_copy_md():
    templates_dir = ROOT / "ads" / "templates"
    tpl_nums = {p.name[:2] for p in templates_dir.glob("[0-9][0-9]-*.html.j2")}
    copy_nums = set(_AD_NUMS)
    missing_in_copy = tpl_nums - copy_nums
    missing_tpl = copy_nums - tpl_nums
    assert not missing_in_copy, f"templates without copy.md section: {sorted(missing_in_copy)}"
    assert not missing_tpl, f"copy.md sections without template: {sorted(missing_tpl)}"
