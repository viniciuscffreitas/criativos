"""Tests for studio_agent schema — validation rules for StudioRequest and StudioPlan."""
from __future__ import annotations

import pytest

from features.copy_generation.schema import Brief
from features.studio_agent.schema import StudioPlan, StudioRequest


# ---------------------------------------------------------------------------
# StudioRequest
# ---------------------------------------------------------------------------

def test_studio_request_requires_non_empty_prompt():
    with pytest.raises(ValueError, match="prompt"):
        StudioRequest(prompt="")


def test_studio_request_rejects_whitespace_only_prompt():
    with pytest.raises(ValueError, match="prompt"):
        StudioRequest(prompt="   \n\t  ")


def test_studio_request_default_n_variants_is_3():
    r = StudioRequest(prompt="post about new service")
    assert r.n_variants == 3


def test_studio_request_rejects_n_variants_zero():
    with pytest.raises(ValueError, match="n_variants"):
        StudioRequest(prompt="x", n_variants=0)


def test_studio_request_rejects_n_variants_too_high():
    with pytest.raises(ValueError, match="n_variants"):
        StudioRequest(prompt="x", n_variants=9)


# ---------------------------------------------------------------------------
# StudioPlan
# ---------------------------------------------------------------------------

def _brief() -> Brief:
    return Brief(product="p", audience="a", pain="x", ctas=["go"])


def test_studio_plan_normalises_methodology_lowercase():
    plan = StudioPlan(
        category="meta-ads", template_id="01-portfolio-grid",
        methodology="PAS",
        brief=_brief(), n_variants=3, reasoning="r",
    )
    assert plan.methodology == "pas"


def test_studio_plan_rejects_unknown_category():
    with pytest.raises(ValueError, match="category"):
        StudioPlan(
            category="bogus", template_id="x", methodology="pas",
            brief=_brief(), n_variants=3, reasoning="r",
        )


def test_studio_plan_rejects_unknown_methodology():
    with pytest.raises(ValueError, match="methodology"):
        StudioPlan(
            category="meta-ads", template_id="01-portfolio-grid",
            methodology="ghost",
            brief=_brief(), n_variants=3, reasoning="r",
        )


def test_studio_plan_accepts_all_three_categories():
    for cat, tpl in [
        ("brand-pack", "brand"),
        ("meta-ads", "01-portfolio-grid"),
        ("instagram", "single-manifesto"),
    ]:
        StudioPlan(
            category=cat, template_id=tpl, methodology="pas",
            brief=_brief(), n_variants=3, reasoning="r",
        )


def test_studio_plan_rejects_n_variants_out_of_range():
    with pytest.raises(ValueError, match="n_variants"):
        StudioPlan(
            category="meta-ads", template_id="01-portfolio-grid",
            methodology="pas",
            brief=_brief(), n_variants=0, reasoning="r",
        )
    with pytest.raises(ValueError, match="n_variants"):
        StudioPlan(
            category="meta-ads", template_id="01-portfolio-grid",
            methodology="pas",
            brief=_brief(), n_variants=99, reasoning="r",
        )
