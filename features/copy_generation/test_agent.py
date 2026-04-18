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
        ctas=["Message me"],
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


def test_invalid_confidence_raises(brief, monkeypatch):
    """Claude returning a confidence outside {high,medium,low} must raise with context, not defer to confidence_symbol access."""
    # Route around dry-run so _call_claude is invoked
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-fake")
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)

    # Mock the Anthropic SDK
    class FakeTextBlock:
        type = "text"
        text = '[{"headline": "H", "primary_text": "P", "description": "D", "confidence": "very high", "reasoning": "r"}]'

    class FakeResponse:
        content = [FakeTextBlock()]

    class FakeMessages:
        def create(self, **kwargs):
            return FakeResponse()

    class FakeAnthropic:
        def __init__(self, *a, **kw):
            self.messages = FakeMessages()

    import anthropic
    monkeypatch.setattr(anthropic, "Anthropic", FakeAnthropic)

    with pytest.raises(RuntimeError, match="invalid confidence"):
        generate(brief, methodology="pas", n=1)


def test_system_prompt_uses_ephemeral_cache(brief, monkeypatch):
    """System prompt must be passed as a cache_control=ephemeral text block — not a plain string — so consecutive calls reuse the cached prefix."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-fake")
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)

    captured: dict = {}

    class FakeTextBlock:
        type = "text"
        text = '[{"headline": "H", "primary_text": "P", "description": "D", "confidence": "high", "reasoning": "r"}]'

    class FakeResponse:
        content = [FakeTextBlock()]

    class FakeMessages:
        def create(self, **kwargs):
            captured.update(kwargs)
            return FakeResponse()

    class FakeAnthropic:
        def __init__(self, *a, **kw):
            self.messages = FakeMessages()

    import anthropic
    monkeypatch.setattr(anthropic, "Anthropic", FakeAnthropic)

    generate(brief, methodology="pas", n=1)

    system = captured["system"]
    assert isinstance(system, list), f"system must be a list of blocks for cache_control, got {type(system).__name__}"
    assert len(system) == 1
    block = system[0]
    assert block["type"] == "text"
    assert block["cache_control"] == {"type": "ephemeral"}
    assert block["text"], "system text must not be empty"


def test_thinking_block_raises(brief, monkeypatch):
    """If the first content block is a thinking block (extended thinking), raise with context — don't silently pick a later block."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-fake")
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)

    class FakeThinkingBlock:
        type = "thinking"
        text = "internal reasoning that should not be parsed as JSON"

    class FakeResponse:
        content = [FakeThinkingBlock()]

    class FakeMessages:
        def create(self, **kwargs):
            return FakeResponse()

    class FakeAnthropic:
        def __init__(self, *a, **kw):
            self.messages = FakeMessages()

    import anthropic
    monkeypatch.setattr(anthropic, "Anthropic", FakeAnthropic)

    with pytest.raises(RuntimeError, match="extended thinking not supported"):
        generate(brief, methodology="pas", n=1)
