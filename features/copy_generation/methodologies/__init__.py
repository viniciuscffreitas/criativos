"""Registry — by_name() is the public entry-point."""
from __future__ import annotations

from features.copy_generation.methodologies.base import Methodology
from features.copy_generation.methodologies.pas import PAS
from features.copy_generation.methodologies.aida import AIDA
from features.copy_generation.methodologies.bab import BAB
from features.copy_generation.methodologies.npqel import NPQEL

_REGISTRY: dict[str, Methodology] = {
    "pas": PAS,
    "aida": AIDA,
    "bab": BAB,
    "npqel": NPQEL,
}


def by_name(name: str) -> Methodology:
    if name not in _REGISTRY:
        known = ", ".join(sorted(_REGISTRY.keys()))
        raise KeyError(f"unknown methodology '{name}' — known: {known}")
    return _REGISTRY[name]
