import pytest
from features.copy_generation.schema import Brief
from features.copy_generation.methodologies import by_name
from features.copy_generation.methodologies.pas import PAS
from features.copy_generation.methodologies.npqel import NPQEL


@pytest.fixture
def brief() -> Brief:
    return Brief(
        product="Custom websites from €450 in 7 days",
        audience="European freelancers",
        pain="Losing clients to competitors with real sites",
        social_proof="6 sites last month",
        cta="Message me",
    )


def test_pas_name_and_description():
    assert PAS.name == "pas"
    assert "Problem" in PAS.description
    assert "Solution" in PAS.description


def test_pas_builds_user_prompt_with_brief_fields(brief):
    prompt = PAS.build_user_prompt(brief, n=3)
    assert "3" in prompt
    assert brief.product in prompt
    assert brief.audience in prompt
    assert brief.pain in prompt
    assert brief.cta in prompt
    assert brief.social_proof in prompt


def test_npqel_is_placeholder(brief):
    assert NPQEL.name == "npqel"
    with pytest.raises(NotImplementedError, match="NPQEL"):
        NPQEL.build_user_prompt(brief, n=3)


def test_registry_resolves_known_names():
    assert by_name("pas") is PAS
    assert by_name("npqel") is NPQEL


def test_registry_unknown_raises():
    with pytest.raises(KeyError, match="unknown methodology"):
        by_name("nonexistent")
