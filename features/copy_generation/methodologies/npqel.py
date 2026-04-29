"""NPQEL — placeholder. Framework not yet defined by the user.

When NPQEL is specified:
  1. Fill prompts/npqel.md with the framework template.
  2. Implement build_user_prompt() analogous to PAS.
  3. Remove the NotImplementedError.
"""
from __future__ import annotations

from pathlib import Path

from features.copy_generation.schema import Brief

_PROMPTS = Path(__file__).parent.parent / "prompts"


class _NPQEL:
    name = "npqel"
    description = "NPQEL — framework pending user definition."
    system_prompt_path = _PROMPTS / "system.md"
    user_prompt_template_path = _PROMPTS / "npqel.md"

    def build_user_prompt(self, brief: Brief, n: int) -> str:
        raise NotImplementedError(
            "NPQEL framework not defined — fill prompts/npqel.md with the "
            "framework template and implement build_user_prompt() in "
            "features/copy_generation/methodologies/npqel.py"
        )


NPQEL = _NPQEL()
