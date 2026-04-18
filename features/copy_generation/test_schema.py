from features.copy_generation.schema import Brief, CopyVariant, AgentResult


def test_brief_has_required_fields():
    b = Brief(
        product="Custom sites",
        audience="Freelancers",
        pain="No site = no clients",
        social_proof="6 sites last month",
        cta="Message me",
    )
    assert b.product == "Custom sites"
    assert b.social_proof == "6 sites last month"


def test_brief_social_proof_optional():
    b = Brief(product="x", audience="y", pain="z", social_proof=None, cta="q")
    assert b.social_proof is None


def test_copy_variant_confidence_symbol():
    v = CopyVariant(
        headline="H", primary_text="P", description="D", confidence="high"
    )
    assert v.confidence_symbol == "✅"

    v2 = CopyVariant(headline="H", primary_text="P", description="D", confidence="medium")
    assert v2.confidence_symbol == "⚠️"

    v3 = CopyVariant(headline="H", primary_text="P", description="D", confidence="low")
    assert v3.confidence_symbol == "🔴"


def test_agent_result_variants_list():
    v = CopyVariant(headline="H", primary_text="P", description="D", confidence="high")
    r = AgentResult(variants=[v, v, v], trace="reasoning…", methodology="pas",
                    model="claude-sonnet-4-6")
    assert len(r.variants) == 3
    assert r.methodology == "pas"
