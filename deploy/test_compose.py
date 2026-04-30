"""Tests for docker-compose.yml — encodes deploy invariants that the VPS
relies on. Pure file-content checks, no docker daemon required.
"""
from __future__ import annotations

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent


def _load_compose() -> dict:
    cf = ROOT / "docker-compose.yml"
    return yaml.safe_load(cf.read_text(encoding="utf-8"))


def test_compose_persists_render_outputs():
    """Generated PNGs MUST persist across rebuilds — without these volumes
    the web app's renders die every `bash deploy/install.sh`. See memory
    file vps_ops_center.md for the rationale.
    """
    data = _load_compose()
    volumes = set(data["services"]["criativos"]["volumes"])
    expected = {
        "./brand/social/renders:/app/brand/social/renders",
        "./brand/favicons:/app/brand/favicons",
        "./ads/renders:/app/ads/renders",
        "./features/instagram_content/renders:/app/features/instagram_content/renders",
    }
    missing = expected - volumes
    assert not missing, (
        f"missing render-output volumes — these PNGs would vanish on rebuild: "
        f"{sorted(missing)}"
    )


def test_compose_keeps_existing_state_volumes():
    """Don't regress the volumes already there: config (yaml source of
    truth), traces (.gitignored run output), uploads (user-uploaded assets).
    """
    data = _load_compose()
    volumes = set(data["services"]["criativos"]["volumes"])
    required = {
        "./config:/app/config",
        "./features/web_gui/traces:/app/features/web_gui/traces",
        "./features/web_gui/uploads:/app/features/web_gui/uploads",
    }
    missing = required - volumes
    assert not missing, f"existing state volumes regressed: {sorted(missing)}"


def test_compose_binds_only_to_loopback():
    """Caddy/nginx terminates TLS in front; the container itself MUST stay
    on 127.0.0.1 to avoid exposing the unauthenticated REST surface."""
    data = _load_compose()
    ports = data["services"]["criativos"]["ports"]
    assert all(p.startswith("127.0.0.1:") for p in ports), (
        f"container port published outside loopback: {ports}"
    )
