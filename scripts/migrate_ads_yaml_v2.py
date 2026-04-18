"""
Idempotent migration: adds kind/placement/format/copy.hero to every ad entry;
converts brief.cta (str) → brief.ctas (list[str]).

Env:
  ADS_YAML_PATH — override path (default: config/ads.yaml relative to repo root)

Running twice = no-op (guarded by presence checks).
"""
from __future__ import annotations
import os
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent

# Per-slug defaults derived from the Spec 1 seeded data.
# Slug → (kind, placement, format, hero_fallback)
DEFAULTS = {
    "portfolio-grid":  ("image", "Instagram Feed · 1:1", "1080×1080 png", "6 sites last month"),
    "before-after":    ("image", "Instagram Feed · 1:1", "1080×1080 png", "Invisible → Booked"),
    "social-proof":    ("image", "Instagram Feed · 1:1", "1080×1080 png", "€500 · 3× more clients"),
    "price-objection": ("image", "Instagram Feed · 1:1", "1080×1080 png", "€3,000? I charge €450"),
    "mockup-showcase": ("image", "Instagram Feed · 1:1", "1080×1080 png", "Still sending to your bio?"),
    "niche-designers": ("image", "Instagram Feed · 1:1", "1080×1080 png", "No site = no clients"),
}


def _resolve_path() -> Path:
    override = os.getenv("ADS_YAML_PATH")
    return Path(override) if override else ROOT / "config" / "ads.yaml"


def migrate(data: dict) -> dict:
    for key, ad in data.get("ads", {}).items():
        slug = ad.get("slug", "")
        kind, placement, fmt, hero_fallback = DEFAULTS.get(
            slug, ("image", "Instagram Feed · 1:1", "1080×1080 png", "")
        )
        ad.setdefault("kind", kind)
        ad.setdefault("placement", placement)
        ad.setdefault("format", fmt)

        brief = ad.setdefault("brief", {})
        if "cta" in brief and "ctas" not in brief:
            cta = brief.pop("cta")
            brief["ctas"] = [cta] if cta else []
        elif "ctas" not in brief:
            brief["ctas"] = []

        copy = ad.setdefault("copy", {})
        if "hero" not in copy:
            # Fallback to the existing headline_lead or a per-slug default
            copy["hero"] = copy.get("headline_lead") or hero_fallback or ad.get("meta", {}).get("headline", "")
    return data


def main() -> int:
    path = _resolve_path()
    if not path.exists():
        print(f"ERROR: {path} not found", file=sys.stderr)
        return 1
    raw = path.read_text(encoding="utf-8")
    data = yaml.safe_load(raw)
    migrated = migrate(data)
    new_yaml = yaml.safe_dump(migrated, sort_keys=False, allow_unicode=True)
    if new_yaml == raw:
        print(f"{path}: already v2 (no-op)")
        return 0
    path.write_text(new_yaml, encoding="utf-8")
    print(f"{path}: migrated to v2")
    return 0


if __name__ == "__main__":
    sys.exit(main())
