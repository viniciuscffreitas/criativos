"""Schema for studio_agent — a conversational layer above copy_generation
+ render_service.

A user prompt becomes a StudioPlan (category + template_id + methodology +
brief + n_variants). The orchestrator then runs the plan: copy gen → render.

v1 produces ONE plan per request; multi-asset planning lands in v2.
"""
from __future__ import annotations

from dataclasses import dataclass

from features.copy_generation.schema import Brief

_VALID_CATEGORIES = frozenset({"brand-pack", "meta-ads", "instagram"})
_VALID_METHODOLOGIES = frozenset({"pas", "aida", "bab"})


@dataclass
class StudioRequest:
    """User-facing request — one prompt + optional knobs."""
    prompt: str
    n_variants: int = 3

    def __post_init__(self) -> None:
        if not self.prompt or not self.prompt.strip():
            raise ValueError(
                "StudioRequest.prompt cannot be empty or whitespace-only"
            )
        if not (1 <= self.n_variants <= 8):
            raise ValueError(
                f"StudioRequest.n_variants must be in [1, 8]; got {self.n_variants}"
            )


@dataclass
class StudioPlan:
    """Agent decision: which asset to produce + with which copy."""
    category: str             # one of _VALID_CATEGORIES
    template_id: str          # e.g. "01-portfolio-grid" or "single-manifesto"
    methodology: str          # one of _VALID_METHODOLOGIES (lowercased)
    brief: Brief              # copy_generation Brief
    n_variants: int
    reasoning: str            # short rationale shown in trace

    def __post_init__(self) -> None:
        self.methodology = self.methodology.lower()
        if self.category not in _VALID_CATEGORIES:
            raise ValueError(
                f"StudioPlan.category {self.category!r} not in {sorted(_VALID_CATEGORIES)}"
            )
        if self.methodology not in _VALID_METHODOLOGIES:
            raise ValueError(
                f"StudioPlan.methodology {self.methodology!r} not in "
                f"{sorted(_VALID_METHODOLOGIES)}"
            )
        if not (1 <= self.n_variants <= 8):
            raise ValueError(
                f"StudioPlan.n_variants must be in [1, 8]; got {self.n_variants}"
            )
