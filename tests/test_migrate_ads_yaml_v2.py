"""
Idempotent migration: ads.yaml v1 → v2 schema.

v2 adds per-ad: kind, placement, format, copy.hero
v2 changes: brief.cta (str) → brief.ctas (list[str])
"""
from __future__ import annotations
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent
ADS = ROOT / "config" / "ads.yaml"
SCRIPT = ROOT / "scripts" / "migrate_ads_yaml_v2.py"


def _run():
    subprocess.run([sys.executable, str(SCRIPT)], check=True, cwd=ROOT)


def test_migration_adds_required_v2_fields(tmp_path, monkeypatch):
    # Work on a copy so we don't touch real config
    copy = tmp_path / "ads.yaml"
    copy.write_text(ADS.read_text(encoding="utf-8"), encoding="utf-8")
    monkeypatch.setenv("ADS_YAML_PATH", str(copy))
    _run()
    data = yaml.safe_load(copy.read_text(encoding="utf-8"))
    for key, ad in data["ads"].items():
        assert ad["kind"] in {"image", "video", "carousel", "copy"}, key
        assert ad["placement"], f"{key}: placement missing"
        assert ad["format"], f"{key}: format missing"
        assert isinstance(ad["brief"].get("ctas"), list), f"{key}: ctas not a list"
        assert "hero" in ad.get("copy", {}), f"{key}: copy.hero missing"


def test_migration_is_idempotent(tmp_path, monkeypatch):
    copy = tmp_path / "ads.yaml"
    copy.write_text(ADS.read_text(encoding="utf-8"), encoding="utf-8")
    monkeypatch.setenv("ADS_YAML_PATH", str(copy))
    _run()
    after_first = copy.read_text(encoding="utf-8")
    _run()
    after_second = copy.read_text(encoding="utf-8")
    assert after_first == after_second, "migration is not idempotent"


def test_migration_preserves_existing_cta_value(tmp_path, monkeypatch):
    copy = tmp_path / "ads.yaml"
    copy.write_text(ADS.read_text(encoding="utf-8"), encoding="utf-8")
    monkeypatch.setenv("ADS_YAML_PATH", str(copy))
    _run()
    data = yaml.safe_load(copy.read_text(encoding="utf-8"))
    # Ad 01 in current yaml has brief.cta="Message me"; after migration it's ctas=["Message me"]
    ad01 = data["ads"]["01_portfolio_grid"]
    assert ad01["brief"]["ctas"] == ["Message me"]


def test_noop_message_when_already_v2(tmp_path, monkeypatch, capfd):
    """After first migration, a second run should print 'already v2'."""
    copy = tmp_path / "ads.yaml"
    copy.write_text(ADS.read_text(encoding="utf-8"), encoding="utf-8")
    monkeypatch.setenv("ADS_YAML_PATH", str(copy))
    _run()  # first: migrates
    capfd.readouterr()  # clear
    _run()  # second: no-op
    out = capfd.readouterr()
    assert "already v2" in out.out or "no-op" in out.out


def test_raises_when_ad_has_no_hero_candidate(tmp_path, monkeypatch):
    """An ad with an unknown slug and no fallback content must fail loudly, not silently."""
    copy = tmp_path / "ads.yaml"
    copy.write_text(yaml.safe_dump({
        "ads": {
            "99_unknown": {
                "id": "99", "slug": "totally-new-slug",
                "brief": {"product": "p", "audience": "a", "pain": "pa"},
                "variants": [],
                # no copy.headline_lead, no meta.headline, slug not in DEFAULTS
            }
        }
    }), encoding="utf-8")
    monkeypatch.setenv("ADS_YAML_PATH", str(copy))
    result = subprocess.run(
        [sys.executable, str(SCRIPT)], cwd=ROOT, capture_output=True, text=True,
    )
    assert result.returncode != 0, "script should crash on missing hero"
    assert "no copy.hero candidate" in result.stderr
