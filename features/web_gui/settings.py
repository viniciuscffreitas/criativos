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
    return ROOT / "features" / "web_gui" / "traces"


def uploads_dir() -> Path:
    return ROOT / "features" / "web_gui" / "uploads"


def static_dir() -> Path:
    return ROOT / "features" / "web_gui" / "static"
