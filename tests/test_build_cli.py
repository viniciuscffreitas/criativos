"""CLI unificado scripts/build.py."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
CLI = ROOT / "scripts" / "build.py"


def test_build_cli_help_lists_flags():
    result = subprocess.run(
        [sys.executable, str(CLI), "--help"],
        capture_output=True, text=True, timeout=10,
    )
    assert result.returncode == 0, result.stderr
    for flag in ("--brand", "--ads", "--all", "--instagram"):
        assert flag in result.stdout, f"missing flag {flag} in help"


def test_build_cli_requires_mode():
    """Sem flag, deve falhar (grupo mutually exclusive required=True)."""
    result = subprocess.run(
        [sys.executable, str(CLI)],
        capture_output=True, text=True, timeout=10,
    )
    assert result.returncode != 0
