"""Input/output contract for the copy generation agent.

Designed for progressive disclosure: readers see the shape before diving
into agent internals.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Confidence = Literal["high", "medium", "low"]

_CONF_SYMBOL = {"high": "✅", "medium": "⚠️", "low": "🔴"}


@dataclass
class Brief:
    """What the agent receives. Maps 1:1 to config/ads.yaml .brief section."""
    product: str
    audience: str
    pain: str
    cta: str
    social_proof: str | None = None


@dataclass
class CopyVariant:
    """One A/B variant. headline/primary_text/description correspond to
    the Meta Ads Manager fields, not to the visual copy inside the PNG."""
    headline: str
    primary_text: str
    description: str
    confidence: Confidence

    @property
    def confidence_symbol(self) -> str:
        return _CONF_SYMBOL[self.confidence]


@dataclass
class AgentResult:
    """Output of `agent.generate()`. `trace` is the chain-of-thought the
    reviewer sees in the GUI or logs — more valuable than the output alone."""
    variants: list[CopyVariant]
    trace: str
    methodology: str
    model: str
