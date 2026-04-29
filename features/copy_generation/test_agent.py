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


def test_parse_cli_envelope_uses_injected_run_id_and_started_at():
    """Callers that know subprocess start time can inject timestamps — needed for streaming path."""
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
    result = _parse_cli_envelope(
        envelope, methodology=by_name("pas"), model="x",
        run_id="fixed123", started_at="2026-04-19T00:00:00Z",
    )
    assert result.run_id == "fixed123"
    assert result.created_at == "2026-04-19T00:00:00Z"


def test_parse_cli_envelope_strips_markdown_fence_with_json_tag():
    from features.copy_generation.agent import _parse_cli_envelope
    from features.copy_generation.methodologies import by_name

    inner = json.dumps([{
        "headline": "h", "primary_text": "p", "description": "d",
        "ctas": ["go"], "confidence": "high", "confidence_score": 0.9,
        "axes": {"relevance": 0.9, "originality": 0.8, "brand_fit": 0.7},
        "reasoning": "r",
    }])
    envelope = {"is_error": False, "result": f"```json\n{inner}\n```"}
    result = _parse_cli_envelope(envelope, methodology=by_name("pas"), model="x")
    assert len(result.variants) == 1
    assert result.variants[0].confidence == "high"
    assert result.methodology == "pas"


def test_parse_cli_envelope_strips_markdown_fence_without_lang_tag():
    from features.copy_generation.agent import _parse_cli_envelope
    from features.copy_generation.methodologies import by_name

    inner = json.dumps([{
        "headline": "h", "primary_text": "p", "description": "d",
        "ctas": ["go"], "confidence": "high", "confidence_score": 0.9,
        "axes": {"relevance": 0.9, "originality": 0.8, "brand_fit": 0.7},
        "reasoning": "r",
    }])
    envelope = {"is_error": False, "result": f"```\n{inner}\n```"}
    result = _parse_cli_envelope(envelope, methodology=by_name("pas"), model="x")
    assert len(result.variants) == 1
    assert result.variants[0].confidence == "high"
    assert result.methodology == "pas"


# ---------------------------------------------------------------------------
# _stream_claude — streaming token + result generator
# ---------------------------------------------------------------------------

class _BaseFakePopen:
    """Minimal Popen stand-in for _stream_claude tests.

    Monkeypatches agent._spawn_cli — not subprocess.Popen — so
    _pipeline_version()'s git rev-parse call isn't intercepted.
    """
    stdout = iter([])
    returncode = 0

    class _Stderr:
        def read(self_inner): return ""

    stderr = _Stderr()

    def __enter__(self): return self
    def __exit__(self, *a): return False
    def wait(self, timeout=None): return self.returncode
    def kill(self): pass
    def poll(self): return self.returncode


def test_stream_claude_yields_text_deltas_then_agent_result(monkeypatch):
    """stream-json: two text_deltas then a result envelope → 2 token yields + 1 result yield."""
    from features.copy_generation import agent
    from features.copy_generation.methodologies import by_name

    lines = [
        '{"type":"stream_event","event":{"type":"message_start","message":{}}}',
        '{"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"text"}}}',
        '{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"[{\\"h"}}}',
        '{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"eadl"}}}',
        json.dumps({
            "type": "result", "subtype": "success", "is_error": False,
            "result": json.dumps([{
                "headline": "H", "primary_text": "P", "description": "D",
                "ctas": ["go"], "confidence": "high", "confidence_score": 0.8,
                "axes": {"relevance": 0.9, "originality": 0.8, "brand_fit": 0.7},
                "reasoning": "r",
            }]),
        }),
    ]

    class FakePopen(_BaseFakePopen):
        def __init__(self, *a, **kw):
            self.stdout = iter(l + "\n" for l in lines)

    monkeypatch.setattr("features.copy_generation.agent._spawn_cli", lambda cmd, env: FakePopen())
    events = list(agent._stream_claude(by_name("pas"), "prompt", n=1, model="x"))
    kinds = [e[0] for e in events]
    assert kinds.count("token") == 2
    assert kinds[-1] == "result"
    assert events[0] == ("token", '[{"h')
    result = events[-1][1]
    assert len(result.variants) == 1
    assert result.variants[0].headline == "H"
    assert result.model == "x"
    assert result.methodology == "pas"


def test_stream_claude_raises_on_missing_result_envelope(monkeypatch):
    """No result envelope in stream → RuntimeError."""
    from features.copy_generation import agent
    from features.copy_generation.methodologies import by_name

    lines = [
        '{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}}',
    ]

    class FakePopen(_BaseFakePopen):
        def __init__(self, *a, **kw):
            self.stdout = iter(l + "\n" for l in lines)

    monkeypatch.setattr("features.copy_generation.agent._spawn_cli", lambda cmd, env: FakePopen())
    with pytest.raises(RuntimeError, match="without a 'result' envelope"):
        list(agent._stream_claude(by_name("pas"), "p", n=1, model="x"))


def test_stream_claude_raises_on_non_zero_exit(monkeypatch):
    """CLI exits with error → RuntimeError with stderr context."""
    from features.copy_generation import agent
    from features.copy_generation.methodologies import by_name

    class FakePopen(_BaseFakePopen):
        def __init__(self, *a, **kw):
            self.stdout = iter([])
            self.returncode = 2

        class _Stderr:
            def read(self_inner): return "auth failed"

        stderr = _Stderr()

        def wait(self, timeout=None): return 2

    monkeypatch.setattr("features.copy_generation.agent._spawn_cli", lambda cmd, env: FakePopen())
    with pytest.raises(RuntimeError, match=r"exited 2.*auth failed"):
        list(agent._stream_claude(by_name("pas"), "p", n=1, model="x"))


def test_stream_claude_raises_on_malformed_line(monkeypatch):
    """Non-JSON line in stream → RuntimeError with the bad line embedded."""
    from features.copy_generation import agent
    from features.copy_generation.methodologies import by_name

    class FakePopen(_BaseFakePopen):
        def __init__(self, *a, **kw):
            self.stdout = iter(["not-json\n"])

    monkeypatch.setattr("features.copy_generation.agent._spawn_cli", lambda cmd, env: FakePopen())
    with pytest.raises(RuntimeError, match="non-JSON line"):
        list(agent._stream_claude(by_name("pas"), "p", n=1, model="x"))
