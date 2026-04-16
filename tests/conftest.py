"""Make the scripts/ directory importable from tests."""
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "scripts"))


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "integration: requer generate.py já executado (produz PNGs)",
    )
