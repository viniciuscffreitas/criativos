"""Pyproject.toml declara e fixa versoes das dependencias."""
import tomllib
from pathlib import Path

ROOT = Path(__file__).parent.parent


def test_pyproject_exists():
    assert (ROOT / "pyproject.toml").is_file()


def test_pyproject_pins_core_deps():
    with (ROOT / "pyproject.toml").open("rb") as f:
        data = tomllib.load(f)
    deps = data["project"]["dependencies"]
    pinned = {d.split(">=")[0].split("==")[0].split("~=")[0].strip(): d for d in deps}
    assert "playwright" in pinned
    assert "pillow" in pinned
    for name, spec in pinned.items():
        assert any(op in spec for op in (">=", "==", "~=")), f"{name} is unpinned"


def test_pyproject_pins_dev_deps():
    with (ROOT / "pyproject.toml").open("rb") as f:
        data = tomllib.load(f)
    dev = data["project"]["optional-dependencies"]["dev"]
    pinned = {d.split(">=")[0].split("==")[0].split("~=")[0].strip(): d for d in dev}
    assert "pytest" in pinned
    assert "pytest-asyncio" in pinned
