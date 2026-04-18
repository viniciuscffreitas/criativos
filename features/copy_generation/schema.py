"""Input/output contract for the copy generation agent.

Designed for progressive disclosure: readers see the shape before diving
into agent internals.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

Confidence = Literal["high", "medium", "low"]

_CONF_SYMBOL = {"high": "✅", "medium": "⚠️", "low": "🔴"}


@dataclass
class Brief:
    """What the agent receives. Maps 1:1 to config/ads.yaml .brief section."""
    product: str
    audience: str
    pain: str
    ctas: list[str] = field(default_factory=list)
    social_proof: str | None = None


@dataclass
class VariantAxes:
    """Per-variant quality scores on three axes (0.0–1.0 each)."""
    relevance: float
    originality: float
    brand_fit: float

    @property
    def warn(self) -> str | None:
        lowest = min(
            ("relevância", self.relevance),
            ("originalidade", self.originality),
            ("brand fit", self.brand_fit),
            key=lambda t: t[1],
        )
        if lowest[1] < 0.6:
            return f"baixa {lowest[0]} ({lowest[1]:.2f})"
        return None


@dataclass
class CopyVariant:
    """One A/B variant. headline/primary_text/description correspond to
    the Meta Ads Manager fields, not to the visual copy inside the PNG."""
    id: str
    headline: str
    primary_text: str
    description: str
    ctas: list[str]
    confidence: Confidence
    confidence_score: float
    axes: VariantAxes
    reasoning: str = ""
    selected: bool = False

    @property
    def confidence_symbol(self) -> str:
        return _CONF_SYMBOL[self.confidence]


@dataclass
class TraceNode:
    """One step in the agent's chain-of-thought trace, suitable for GUI rendering."""
    id: str
    label: str
    start_ms: int
    end_ms: int
    tokens: int
    confidence: float | None
    output_preview: str


@dataclass
class AgentResult:
    """Output of `agent.generate()`. `trace` is the chain-of-thought the
    reviewer sees in the GUI or logs — more valuable than the output alone."""
    run_id: str
    variants: list[CopyVariant]
    trace: str
    trace_structured: list[TraceNode]
    methodology: str
    model: str
    pipeline_version: str
    seed: int | None = None
    created_at: str = ""
