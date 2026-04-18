"""Structural validation of config/ads.yaml — shape, required fields, IDs match filesystem."""
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).parent.parent
CONFIG = ROOT / "config" / "ads.yaml"
TEMPLATES_DIR = ROOT / "ads" / "templates"

EXPECTED_IDS = ["01", "02", "03", "04", "05", "06"]
KNOWN_METHODOLOGIES = {"pas", "npqel"}


def _data() -> dict:
    return yaml.safe_load(CONFIG.read_text(encoding="utf-8"))


def _all_ad_keys() -> list[str]:
    """Collection-time YAML read so parametrize auto-covers new ads."""
    return list(_data()["ads"].keys())


def test_config_parses():
    data = _data()
    assert "ads" in data, "top-level 'ads' key missing"


def test_all_six_ads_present():
    ads = _data()["ads"]
    ids = sorted(a["id"] for a in ads.values())
    assert ids == EXPECTED_IDS, f"expected {EXPECTED_IDS}, got {ids}"


@pytest.mark.parametrize("ad_key", _all_ad_keys())
def test_ad_has_required_sections(ad_key):
    ad = _data()["ads"][ad_key]
    for section in ("id", "slug", "methodology", "brief", "copy", "meta"):
        assert section in ad, f"{ad_key}: missing section '{section}'"


@pytest.mark.parametrize("ad_key", _all_ad_keys())
def test_brief_has_required_fields(ad_key):
    # social_proof is intentionally nullable (not all ads lean on numeric proof).
    brief = _data()["ads"][ad_key]["brief"]
    for field in ("product", "audience", "pain", "cta"):
        assert field in brief and brief[field], f"{ad_key}.brief.{field} empty"


def test_methodology_is_known():
    for key, ad in _data()["ads"].items():
        assert ad["methodology"] in KNOWN_METHODOLOGIES, (
            f"{key}: unknown methodology '{ad['methodology']}'"
        )


def test_ids_match_template_prefixes():
    yaml_ids = {a["id"] for a in _data()["ads"].values()}
    fs_ids = {p.name[:2] for p in TEMPLATES_DIR.glob("[0-9][0-9]-*.*")}
    assert yaml_ids == fs_ids, f"YAML ids {yaml_ids} != template prefixes {fs_ids}"
