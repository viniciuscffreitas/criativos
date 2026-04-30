"""Tests for studio_agent.planner — dry-run keyword routing + real CLI shell."""
from __future__ import annotations

import pytest

import features.studio_agent.planner as planner_mod
from features.studio_agent.planner import _is_dry_run, plan
from features.studio_agent.schema import StudioRequest


# ---------------------------------------------------------------------------
# _is_dry_run
# ---------------------------------------------------------------------------

def test_is_dry_run_true_when_env_set(monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    assert _is_dry_run() is True


def test_is_dry_run_true_when_no_auth(monkeypatch):
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)
    monkeypatch.delenv("CLAUDE_CODE_OAUTH_TOKEN", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert _is_dry_run() is True


def test_is_dry_run_false_when_auth_set(monkeypatch):
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-real")
    assert _is_dry_run() is False


# ---------------------------------------------------------------------------
# Dry-run keyword routing
# ---------------------------------------------------------------------------

def test_dry_run_meta_ads_keyword(monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    p = plan(StudioRequest(prompt="quero um anúncio Meta sobre meu serviço"))
    assert p.category == "meta-ads"
    assert p.template_id.startswith(("01-", "02-", "03-", "04-", "05-", "06-"))
    assert p.methodology in {"pas", "aida", "bab"}
    assert p.brief.ctas


def test_dry_run_instagram_keyword(monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    p = plan(StudioRequest(prompt="post Instagram sobre lançamento"))
    assert p.category == "instagram"
    assert p.template_id


def test_dry_run_brand_keyword_logos(monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    p = plan(StudioRequest(prompt="logo + favicons da marca"))
    assert p.category == "brand-pack"


def test_dry_run_default_to_meta_ads_when_ambiguous(monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    p = plan(StudioRequest(prompt="gera algo legal"))
    # Stable default for ambiguous prompts — meta-ads (the historical primary)
    assert p.category == "meta-ads"


def test_dry_run_carousel_routes_to_instagram(monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    p = plan(StudioRequest(prompt="quero um carrossel sobre meus serviços"))
    assert p.category == "instagram"


def test_dry_run_preserves_n_variants(monkeypatch):
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "1")
    p = plan(StudioRequest(prompt="post", n_variants=5))
    assert p.n_variants == 5


# ---------------------------------------------------------------------------
# Real-mode CLI (mocked)
# ---------------------------------------------------------------------------

def test_real_mode_calls_cli(monkeypatch):
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-fake")

    captured = {"called": 0}

    def _fake_run_cli(prompt, system_prompt, model):
        captured["called"] += 1
        captured["prompt"] = prompt
        captured["model"] = model
        return {
            "category": "meta-ads",
            "template_id": "01-portfolio-grid",
            "methodology": "pas",
            "brief": {
                "product": "Custom websites",
                "audience": "freelancers",
                "pain": "no website",
                "ctas": ["Message me"],
                "social_proof": None,
            },
            "n_variants": 3,
            "reasoning": "user wants meta ad",
        }

    monkeypatch.setattr(planner_mod, "_run_cli", _fake_run_cli)

    p = plan(StudioRequest(prompt="quero um anúncio"))
    assert captured["called"] == 1
    assert captured["prompt"] == "quero um anúncio"
    assert p.category == "meta-ads"
    assert p.brief.product == "Custom websites"
    assert p.brief.ctas == ["Message me"]


def test_real_mode_malformed_dict_raises(monkeypatch):
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-fake")

    def _fake_run_cli(prompt, system_prompt, model):
        return {"category": "meta-ads"}  # missing required fields

    monkeypatch.setattr(planner_mod, "_run_cli", _fake_run_cli)

    with pytest.raises(RuntimeError, match="malformed plan"):
        plan(StudioRequest(prompt="x"))


def test_real_mode_non_dict_raises(monkeypatch):
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-fake")

    def _fake_run_cli(prompt, system_prompt, model):
        return "not a dict"

    monkeypatch.setattr(planner_mod, "_run_cli", _fake_run_cli)

    with pytest.raises(RuntimeError, match="non-dict"):
        plan(StudioRequest(prompt="x"))


def test_strip_markdown_fence_removes_json_fence():
    """Claude often wraps JSON in ```json...``` fences despite the system
    prompt asking for raw JSON. _strip_markdown_fence must handle this."""
    from features.studio_agent.planner import _strip_markdown_fence
    fenced = '```json\n{"a": 1}\n```'
    assert _strip_markdown_fence(fenced) == '{"a": 1}'


def test_strip_markdown_fence_removes_plain_fence():
    from features.studio_agent.planner import _strip_markdown_fence
    fenced = '```\n{"a": 1}\n```'
    assert _strip_markdown_fence(fenced) == '{"a": 1}'


def test_strip_markdown_fence_passthrough_when_no_fence():
    from features.studio_agent.planner import _strip_markdown_fence
    raw = '{"a": 1}'
    assert _strip_markdown_fence(raw) == raw


def test_real_mode_handles_fenced_json_response(monkeypatch):
    """End-to-end: real-mode with a CLI that returns fenced JSON must
    parse correctly. This was a real prod bug from the first deploy."""
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-fake")

    # Simulate the actual prod failure: CLI envelope's "result" field is
    # raw text with a markdown fence around the JSON. The planner must
    # strip that before json.loads.
    import json as _json
    import subprocess

    fake_result = '```json\n' + _json.dumps({
        "category": "instagram",
        "template_id": "single-manifesto",
        "methodology": "aida",
        "brief": {
            "product": "Novo site",
            "audience": "Seguidores",
            "pain": "Dificuldade",
            "ctas": ["Acesse"],
            "social_proof": None,
        },
        "n_variants": 3,
        "reasoning": "Manifesto AIDA",
    }) + '\n```'
    fake_envelope = {"result": fake_result, "is_error": False}

    class _FakeProc:
        returncode = 0
        stdout = _json.dumps(fake_envelope)
        stderr = ""

    monkeypatch.setattr(planner_mod.shutil, "which", lambda _x: "/fake/claude")
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: _FakeProc())

    p = plan(StudioRequest(prompt="post Instagram"))
    assert p.category == "instagram"
    assert p.template_id == "single-manifesto"
    assert p.methodology == "aida"


def test_real_mode_invalid_brief_propagates(monkeypatch):
    """Brief.__post_init__ raises ValueError on empty ctas — surface that."""
    monkeypatch.delenv("VIBEWEB_DRY_RUN", raising=False)
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-fake")

    def _fake_run_cli(prompt, system_prompt, model):
        return {
            "category": "meta-ads",
            "template_id": "01-portfolio-grid",
            "methodology": "pas",
            "brief": {
                "product": "p", "audience": "a", "pain": "x",
                "ctas": [],
                "social_proof": None,
            },
            "n_variants": 3,
            "reasoning": "r",
        }

    monkeypatch.setattr(planner_mod, "_run_cli", _fake_run_cli)

    with pytest.raises(RuntimeError, match="malformed plan"):
        plan(StudioRequest(prompt="x"))
