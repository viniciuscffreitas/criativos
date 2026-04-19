"""
Env-sourced settings. No framework, no pydantic-settings — verbose on purpose.
"""
from __future__ import annotations
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def projects_yaml_path() -> Path:
    return Path(os.getenv("VIBEWEB_PROJECTS_YAML", str(ROOT / "config" / "projects.yaml")))


def traces_dir() -> Path:
    p = ROOT / "features" / "web_gui" / "traces"
    p.mkdir(parents=True, exist_ok=True)
    return p


def uploads_dir() -> Path:
    p = ROOT / "features" / "web_gui" / "uploads"
    p.mkdir(parents=True, exist_ok=True)
    return p


def static_dir() -> Path:
    return ROOT / "features" / "web_gui" / "static"
