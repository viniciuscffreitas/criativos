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


def test_wheel_includes_both_packages():
    """vibeweb-build --ads imports from ads.render — packaging must ship it."""
    with (ROOT / "pyproject.toml").open("rb") as f:
        data = tomllib.load(f)
    include = data["tool"]["setuptools"]["packages"]["find"]["include"]
    assert "scripts*" in include, "scripts package missing from wheel"
    assert "ads*" in include, "ads package missing — vibeweb-build --ads will fail on wheel install"


def test_both_packages_have_init_py():
    assert (ROOT / "scripts" / "__init__.py").is_file()
    assert (ROOT / "ads" / "__init__.py").is_file()


def test_pyproject_pins_spec1_deps():
    """Spec 1 introduces Jinja2 (templating), PyYAML (config), anthropic (LLM)."""
    with (ROOT / "pyproject.toml").open("rb") as f:
        data = tomllib.load(f)
    pinned = {d.split(">=")[0].split("==")[0].split("~=")[0].strip(): d
              for d in data["project"]["dependencies"]}
    for required in ("jinja2", "pyyaml", "anthropic"):
        assert required in pinned, f"{required} missing from [project].dependencies"
        spec = pinned[required]
        assert any(op in spec for op in (">=", "==", "~=")), f"{required} is unpinned"


def test_wheel_includes_features_package():
    """features/ is the target layout for all new feature code (CLAUDE.md §2.1)."""
    with (ROOT / "pyproject.toml").open("rb") as f:
        data = tomllib.load(f)
    include = data["tool"]["setuptools"]["packages"]["find"]["include"]
    assert "features*" in include, "features package missing from wheel"
