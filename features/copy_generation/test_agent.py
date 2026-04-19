import json
import os

import pytest

from features.copy_generation.agent import generate, DEFAULT_MODEL
from features.copy_generation.schema import AgentResult, Brief

_FAKE_PAYLOAD = (
    '[{"headline":"H","primary_text":"P","description":"D",'
    '"ctas":["C1"],"confidence":"high","confidence_score":0.9,'
    '"axes":{"relevance":0.9,"originality":0.9,"brand_fit":0.9},'
    '"reasoning":"r"}]'
)

_FAKE_PAYLOAD_INVALID_CONF = _FAKE_PAYLOAD.replace('"confidence":"high"', '"confidence":"very high"')


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


def test_dry_run_when_no_auth(brief, monkeypatch):
    """Missing both ANTHROPIC_API_KEY and CLAUDE_CODE_OAUTH_TOKEN triggers dry-run."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("CLAUDE_CODE_OAUTH_TOKEN", raising=False)
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


def _patch_cli(monkeypatch, stdout_variants_json: str):
    """Helper: mock subprocess.run to return a successful CLI envelope wrapping the given payload."""
    import json as _json

    class FakeCompleted:
        returncode = 0
        stdout = _json.dumps({
            "type": "result", "subtype": "success", "is_error": False,
            "cost_usd": 0.001, "num_turns": 1,
            "result": stdout_variants_json,
            "session_id": "fake",
        })
        stderr = ""

    def fake_run(cmd, **kwargs):
        return FakeCompleted()

    import features.copy_generation.agent as agent_mod
    monkeypatch.setattr(agent_mod, "_run_cli", lambda cmd, env: fake_run(cmd, env=env))


def test_invalid_confidence_raises(brief, monkeypatch):
    """CLI returning a confidence outside {high,medium,low} must raise with context."""
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-xxx")
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)
    _patch_cli(monkeypatch, _FAKE_PAYLOAD_INVALID_CONF)
    with pytest.raises(RuntimeError, match="invalid confidence"):
        generate(brief, methodology="pas", n=1)


def test_missing_axes_field_raises(brief, monkeypatch):
    """CLI omitting 'axes' must raise with full payload in error, not default silently."""
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-xxx")
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)
    _patch_cli(
        monkeypatch,
        '[{"headline":"H","primary_text":"P","description":"D","ctas":["C"],'
        '"confidence":"high","confidence_score":0.9,"reasoning":"r"}]',
    )
    with pytest.raises(RuntimeError, match="missing required fields"):
        generate(brief, methodology="pas", n=1)


# ---------------------------------------------------------------------------
# Phase 2 — OAuth backend via `claude` CLI subprocess
# ---------------------------------------------------------------------------

def _fake_cli_stdout(variants_json: str) -> str:
    """Shape the `claude -p --output-format json` wrapper around a result string."""
    import json as _json
    return _json.dumps({
        "type": "result", "subtype": "success", "is_error": False,
        "cost_usd": 0.001, "num_turns": 1,
        "result": variants_json,
        "session_id": "fake",
    })


def test_is_dry_run_false_when_oauth_token_set(monkeypatch):
    """OAuth token alone disables dry-run, even without ANTHROPIC_API_KEY."""
    from features.copy_generation.agent import _is_dry_run
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-xxx")
    assert _is_dry_run() is False


def test_is_dry_run_true_when_all_auth_missing(monkeypatch):
    from features.copy_generation.agent import _is_dry_run
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("CLAUDE_CODE_OAUTH_TOKEN", raising=False)
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)
    assert _is_dry_run() is True


def test_real_mode_invokes_claude_cli_subprocess(brief, monkeypatch):
    """Real mode must shell out to `claude -p` with --output-format json, not the Python SDK."""
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-xxx")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)

    captured: dict = {}

    class FakeCompleted:
        returncode = 0
        stdout = _fake_cli_stdout(_FAKE_PAYLOAD)
        stderr = ""

    def fake_run(cmd, **kwargs):
        captured["cmd"] = cmd
        captured["env"] = kwargs.get("env")
        captured["kwargs"] = kwargs
        return FakeCompleted()

    import features.copy_generation.agent as agent_mod
    monkeypatch.setattr(agent_mod, "_run_cli", lambda cmd, env: fake_run(cmd, env=env))

    result = generate(brief, methodology="pas", n=1)

    assert result.variants[0].headline == "H"
    assert captured["cmd"][0] == "claude"
    assert "-p" in captured["cmd"]
    assert "--output-format" in captured["cmd"]
    assert captured["cmd"][captured["cmd"].index("--output-format") + 1] == "json"
    assert "--model" in captured["cmd"]
    assert captured["cmd"][captured["cmd"].index("--model") + 1] == DEFAULT_MODEL
    assert "--append-system-prompt" in captured["cmd"]


def test_real_mode_injects_oauth_env_and_strips_empty_api_key(brief, monkeypatch):
    """Env must carry CLAUDE_CODE_OAUTH_TOKEN and strip an empty ANTHROPIC_API_KEY
    (Claude CLI treats '' as a credential and fails instead of falling back)."""
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-real")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")  # explicit empty
    monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "")  # ditto
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)

    captured: dict = {}

    class FakeCompleted:
        returncode = 0
        stdout = _fake_cli_stdout(_FAKE_PAYLOAD)
        stderr = ""

    def fake_run(cmd, **kwargs):
        captured["env"] = kwargs.get("env")
        return FakeCompleted()

    import features.copy_generation.agent as agent_mod
    monkeypatch.setattr(agent_mod, "_run_cli", lambda cmd, env: fake_run(cmd, env=env))

    generate(brief, methodology="pas", n=1)

    env = captured["env"]
    assert env is not None, "agent must pass explicit env to subprocess"
    assert env["CLAUDE_CODE_OAUTH_TOKEN"] == "sk-ant-oat-real"
    assert "ANTHROPIC_API_KEY" not in env, "empty ANTHROPIC_API_KEY must be stripped"
    assert "ANTHROPIC_AUTH_TOKEN" not in env, "empty ANTHROPIC_AUTH_TOKEN must be stripped"


def test_real_mode_strips_nonempty_api_key_when_oauth_present(brief, monkeypatch):
    """Non-empty ANTHROPIC_API_KEY must be stripped when a valid OAuth token is set.
    The CLI picks API key first, so leaving a stale/invalid key would shadow OAuth
    and fail auth — paperweight's pattern."""
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-valid")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-api-stale")
    monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "sk-ant-api-stale-auth")
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)

    captured: dict = {}

    class FakeCompleted:
        returncode = 0
        stdout = _fake_cli_stdout(_FAKE_PAYLOAD)
        stderr = ""

    def fake_run(cmd, **kwargs):
        captured["env"] = kwargs.get("env")
        return FakeCompleted()

    import features.copy_generation.agent as agent_mod
    monkeypatch.setattr(agent_mod, "_run_cli", lambda cmd, env: fake_run(cmd, env=env))

    generate(brief, methodology="pas", n=1)

    env = captured["env"]
    assert env["CLAUDE_CODE_OAUTH_TOKEN"] == "sk-ant-oat-valid"
    assert "ANTHROPIC_API_KEY" not in env, "non-empty ANTHROPIC_API_KEY must be stripped when OAuth is set"
    assert "ANTHROPIC_AUTH_TOKEN" not in env, "non-empty ANTHROPIC_AUTH_TOKEN must be stripped when OAuth is set"


def test_real_mode_cli_error_raises_with_context(brief, monkeypatch):
    """Non-zero exit or is_error=true must raise RuntimeError with stderr context, not silently."""
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-xxx")
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)

    class FakeCompleted:
        returncode = 1
        stdout = ""
        stderr = "auth failure: token rejected"

    def fake_run(cmd, **kwargs):
        return FakeCompleted()

    import features.copy_generation.agent as agent_mod
    monkeypatch.setattr(agent_mod, "_run_cli", lambda cmd, env: fake_run(cmd, env=env))

    with pytest.raises(RuntimeError, match="claude CLI"):
        generate(brief, methodology="pas", n=1)


def test_real_mode_cli_reports_is_error_true(brief, monkeypatch):
    """CLI may return exit 0 but is_error=true in the JSON wrapper — still a failure."""
    import json as _json
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-xxx")
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)

    class FakeCompleted:
        returncode = 0
        stdout = _json.dumps({
            "type": "result", "subtype": "error_max_turns",
            "is_error": True, "result": "max turns reached",
        })
        stderr = ""

    def fake_run(cmd, **kwargs):
        return FakeCompleted()

    import features.copy_generation.agent as agent_mod
    monkeypatch.setattr(agent_mod, "_run_cli", lambda cmd, env: fake_run(cmd, env=env))

    with pytest.raises(RuntimeError, match="is_error"):
        generate(brief, methodology="pas", n=1)


def test_parse_cli_envelope_returns_agent_result_from_well_formed_envelope():
    from features.copy_generation.agent import _parse_cli_envelope
    from features.copy_generation.methodologies import by_name

    envelope = {
        "is_error": False,
        "result": json.dumps([{
            "headline": "h", "primary_text": "p", "description": "d",
            "ctas": ["go"], "confidence": "high", "confidence_score": 0.9,
            "axes": {"relevance": 0.9, "originality": 0.8, "brand_fit": 0.7},
            "reasoning": "r",
        }]),
    }
    result = _parse_cli_envelope(envelope, methodology=by_name("pas"), model="x")
    assert len(result.variants) == 1
    assert result.variants[0].confidence == "high"
    assert result.methodology == "pas"
    assert result.model == "x"
