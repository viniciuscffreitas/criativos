import json
import os

import pytest

from features.copy_generation.agent import generate, DEFAULT_MODEL
from features.copy_generation.schema import AgentResult, Brief


@pytest.fixture
def brief() -> Brief:
    return Brief(
        product="Custom websites from €450 in 7 days",
        audience="European freelancers",
        pain="Losing clients to competitors with real sites",
        social_proof="6 sites last month",
        cta="Message me",
    )


def test_default_model_is_sonnet_4_6():
    assert DEFAULT_MODEL == "claude-sonnet-4-6"


def test_dry_run_returns_n_variants(brief, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    result = generate(brief, methodology="pas", n=3)
    assert isinstance(result, AgentResult)
    assert len(result.variants) == 3
    assert result.methodology == "pas"
    assert result.model == "dry-run"


def test_dry_run_is_deterministic(brief, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    a = generate(brief, methodology="pas", n=3)
    b = generate(brief, methodology="pas", n=3)
    assert [v.headline for v in a.variants] == [v.headline for v in b.variants]


def test_dry_run_when_no_api_key(brief, monkeypatch):
    """Missing ANTHROPIC_API_KEY alone triggers dry-run, no VIBEWEB_DRY_RUN needed."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)
    result = generate(brief, methodology="pas", n=2)
    assert result.model == "dry-run"
    assert len(result.variants) == 2


def test_unknown_methodology_raises(brief, monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    with pytest.raises(KeyError, match="unknown methodology"):
        generate(brief, methodology="ghost", n=3)


def test_npqel_dry_run_still_raises(brief, monkeypatch):
    """Dry-run doesn't bypass the NotImplementedError — NPQEL is a real stub."""
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    with pytest.raises(NotImplementedError, match="NPQEL"):
        generate(brief, methodology="npqel", n=3)


@pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY") or os.getenv("VIBEWEB_DRY_RUN") == "1",
    reason="requires real ANTHROPIC_API_KEY and VIBEWEB_DRY_RUN unset",
)
def test_real_api_call(brief):
    result = generate(brief, methodology="pas", n=3)
    assert result.model == DEFAULT_MODEL
    assert len(result.variants) == 3
    for v in result.variants:
        assert v.headline
        assert v.primary_text
        assert v.confidence in {"high", "medium", "low"}
