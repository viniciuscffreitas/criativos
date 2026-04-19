"""BAB — Before, After, Bridge. Outcome-first direct-response framework."""
from __future__ import annotations

from pathlib import Path

from features.copy_generation.schema import Brief

_PROMPTS = Path(__file__).parent.parent / "prompts"


class _BAB:
    name = "bab"
    description = (
        "Before-After-Bridge: paint the current pain, paint the desired state, "
        "position the product as the bridge between them."
    )
    system_prompt_path = _PROMPTS / "system.md"
    user_prompt_template_path = _PROMPTS / "bab.md"

    def build_user_prompt(self, brief: Brief, n: int) -> str:
        template = self.user_prompt_template_path.read_text(encoding="utf-8")
        return template.format(
            product=brief.product,
            audience=brief.audience,
            pain=brief.pain,
            social_proof=brief.social_proof or "none",
            ctas=", ".join(brief.ctas),
            n=n,
        )


BAB = _BAB()
