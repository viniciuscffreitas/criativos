from features.copy_generation.schema import (
    AgentResult, Brief, CopyVariant, TraceNode, VariantAxes,
)


def test_brief_has_required_fields():
    b = Brief(
        product="Custom sites",
        audience="Freelancers",
        pain="No site = no clients",
        social_proof="6 sites last month",
        ctas=["Message me"],
    )
    assert b.product == "Custom sites"
    assert b.social_proof == "6 sites last month"


def test_brief_social_proof_optional():
    b = Brief(product="x", audience="y", pain="z", social_proof=None, ctas=[])
    assert b.social_proof is None


def test_copy_variant_confidence_symbol():
    v = CopyVariant(
        id="V1", headline="H", primary_text="P", description="D",
        ctas=[], confidence="high", confidence_score=0.9,
        axes=VariantAxes(0.9, 0.9, 0.9),
    )
    assert v.confidence_symbol == "✅"

    v2 = CopyVariant(
        id="V2", headline="H", primary_text="P", description="D",
        ctas=[], confidence="medium", confidence_score=0.6,
        axes=VariantAxes(0.6, 0.6, 0.6),
    )
    assert v2.confidence_symbol == "⚠️"

    v3 = CopyVariant(
        id="V3", headline="H", primary_text="P", description="D",
        ctas=[], confidence="low", confidence_score=0.3,
        axes=VariantAxes(0.3, 0.3, 0.3),
    )
    assert v3.confidence_symbol == "🔴"


def test_agent_result_variants_list():
    v = CopyVariant(
        id="V1", headline="H", primary_text="P", description="D",
        ctas=[], confidence="high", confidence_score=0.9,
        axes=VariantAxes(0.9, 0.9, 0.9),
    )
    r = AgentResult(
        run_id="abc12345",
        variants=[v, v, v],
        trace="reasoning…",
        trace_structured=[],
        methodology="pas",
        model="claude-sonnet-4-6",
        pipeline_version="copy_generation@test",
    )
    assert len(r.variants) == 3
    assert r.methodology == "pas"


def test_variant_axes_warn_when_any_below_threshold():
    axes = VariantAxes(relevance=0.55, originality=0.9, brand_fit=0.9)
    assert axes.warn is not None
    assert "relevância" in axes.warn


def test_variant_axes_no_warn_when_all_above():
    axes = VariantAxes(relevance=0.8, originality=0.85, brand_fit=0.9)
    assert axes.warn is None


def test_copy_variant_carries_id_and_ctas():
    v = CopyVariant(
        id="V1", headline="H", primary_text="P", description="D",
        ctas=["Compra"], confidence="high", confidence_score=0.9,
        axes=VariantAxes(0.9, 0.9, 0.9), reasoning="r",
    )
    assert v.id == "V1"
    assert v.ctas == ["Compra"]
    assert v.confidence_symbol == "✅"


def test_agent_result_carries_run_id_and_structured_trace():
    result = AgentResult(
        run_id="abc12345",
        variants=[],
        trace="raw",
        trace_structured=[
            TraceNode(id="brief", label="Briefing", start_ms=0, end_ms=10,
                      tokens=0, confidence=None, output_preview="...")
        ],
        methodology="pas",
        model="claude-sonnet-4-6",
        pipeline_version="copy_generation@abc1234",
        seed=None,
        created_at="2026-04-18T12:00:00Z",
    )
    assert len(result.trace_structured) == 1
    assert result.trace_structured[0].label == "Briefing"
