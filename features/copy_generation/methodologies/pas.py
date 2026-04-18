"""PAS — Problem, Agitate, Solution. Direct-response copywriting framework."""
from __future__ import annotations

from pathlib import Path

from features.copy_generation.schema import Brief

_PROMPTS = Path(__file__).parent.parent / "prompts"


class _PAS:
    name = "pas"
    description = (
        "Problem-Agitate-Solution: surface the pain, amplify its cost, "
        "then present the offer as resolution."
    )
    system_prompt_path = _PROMPTS / "system.md"
    user_prompt_template_path = _PROMPTS / "pas.md"

    def build_user_prompt(self, brief: Brief, n: int) -> str:
        template = self.user_prompt_template_path.read_text(encoding="utf-8")
        return template.format(
            n=n,
            product=brief.product,
            audience=brief.audience,
            pain=brief.pain,
            social_proof=brief.social_proof or "(none)",
            cta=", ".join(brief.ctas),
        )


PAS = _PAS()
