"""Methodology contract. Every framework (PAS, NPQEL, …) implements this Protocol."""
from __future__ import annotations

from pathlib import Path
from typing import Protocol

from features.copy_generation.schema import Brief


class Methodology(Protocol):
    name: str
    description: str
    system_prompt_path: Path

    def build_user_prompt(self, brief: Brief, n: int) -> str: ...
