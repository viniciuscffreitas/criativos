# Task 9b — Real-mode streaming via `claude --output-format stream-json`

> **For agentic workers:** execute task-by-task with TDD RED → GREEN → REFACTOR.
> SSE event shape is a load-bearing contract (CLAUDE.md §2.3) — preserve it exactly.

**Goal:** Emit `token` SSE events DURING real-mode Claude CLI execution instead of after, so the Generate pipeline screen animates in prod with the same UX as dry-run.

**Architecture:** Add `_stream_claude(...)` generator to `features/copy_generation/agent.py` that spawns `claude … --output-format stream-json --include-partial-messages --verbose` via `subprocess.Popen`, iterates `stdout` line-by-line, yields `("token", text)` on each `text_delta`, and finally `("result", AgentResult)` once the final `result` envelope arrives. Add `real_stream_events(...)` to `features/copy_generation/streaming.py` that mirrors `dry_run_events`' SSE shape but consumes `_stream_claude`. Replace `_replay_events` in `features/web_gui/api/generate.py`. The non-streaming `_call_claude` path stays intact for `POST /generate`.

**Tech:** Python `subprocess.Popen` (line-buffered stdout), FastAPI `StreamingResponse`, existing SSE helpers.

---

## File Structure

- **Modify** `features/copy_generation/agent.py`
  - Extract shared `_parse_cli_envelope(envelope: dict, methodology, model) -> AgentResult` helper (the payload parsing in `_call_claude` lines 139-228).
  - Add `_stream_claude(methodology, user_prompt, n, model) -> Iterator[tuple[str, Any]]` that yields `("token", str)` and finally `("result", AgentResult)`.
  - `_call_claude` refactored to reuse `_parse_cli_envelope` (no behavior change).
- **Modify** `features/copy_generation/streaming.py`
  - Add `real_stream_events(brief, methodology, n, model) -> Iterator[str]` emitting same SSE shape as `dry_run_events`.
- **Modify** `features/web_gui/api/generate.py`
  - Replace body of `_replay_events` with a call to `real_stream_events`, or inline drop-in.
- **Tests:**
  - `features/copy_generation/test_agent.py` — mock `subprocess.Popen` to emit a canned NDJSON stream; assert `_stream_claude` yields tokens then parsed AgentResult.
  - `features/copy_generation/test_streaming.py` (new) — monkeypatch `_stream_claude` with a fake generator; assert `real_stream_events` emits `run_start`, `node_start(brief)`, `node_done(brief)`, `node_start(agent)`, N `token` frames interleaved, N `variant_done`, `node_done(agent)`, `done`.
  - `features/web_gui/test_server.py` — contract test: `/generate/stream` in real-mode (fake `_stream_claude`) produces the same frame sequence as dry-run for a known input.

---

## Task 1: Extract `_parse_cli_envelope` helper (pure refactor, no behavior change)

**Files:**
- Modify: `features/copy_generation/agent.py:112-228`
- Modify: `features/copy_generation/test_agent.py` (existing tests must still pass)

- [ ] **Step 1: RED — add test that exercises the helper directly**

```python
# features/copy_generation/test_agent.py — add to existing test module
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
```

Run: `pytest features/copy_generation/test_agent.py::test_parse_cli_envelope_returns_agent_result_from_well_formed_envelope -v`
Expected: FAIL (ImportError).

- [ ] **Step 2: GREEN — extract the helper**

Move the payload-parsing block (currently lines 139-227) out of `_call_claude` into a new private function `_parse_cli_envelope(envelope: dict, methodology, model: str) -> AgentResult`. `_call_claude` becomes: run subprocess → `json.loads(stdout)` → `_parse_cli_envelope`. Preserve every error message and validation exactly.

Signature:
```python
def _parse_cli_envelope(envelope: dict, methodology, model: str) -> AgentResult: ...
```

- [ ] **Step 3: Run full suite**

Run: `pytest features/copy_generation/ -q`
Expected: all existing tests PASS (refactor preserves behavior).

- [ ] **Step 4: Commit**

```bash
git add features/copy_generation/agent.py features/copy_generation/test_agent.py
git commit -m "refactor(copy_generation): extract _parse_cli_envelope helper"
```

---

## Task 2: `_stream_claude` generator with mocked subprocess

**Files:**
- Modify: `features/copy_generation/agent.py` — add `_stream_claude`
- Modify: `features/copy_generation/test_agent.py`

- [ ] **Step 1: RED — test yields tokens then AgentResult**

```python
def test_stream_claude_yields_text_deltas_then_agent_result(monkeypatch):
    """Simulate CLI streaming: two text_deltas, then a result envelope."""
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

    class FakePopen:
        def __init__(self, *a, **kw):
            self.stdout = iter(l + "\n" for l in lines)
            self.stderr = type("E", (), {"read": lambda self: ""})()
            self.returncode = 0
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def wait(self, timeout=None): return 0

    monkeypatch.setattr("subprocess.Popen", lambda *a, **kw: FakePopen())
    events = list(agent._stream_claude(by_name("pas"), "prompt", n=1, model="x"))
    kinds = [e[0] for e in events]
    assert kinds.count("token") == 2
    assert kinds[-1] == "result"
    assert events[0] == ("token", "[{\"h")
    result = events[-1][1]
    assert len(result.variants) == 1
    assert result.variants[0].headline == "H"
```

Run: `pytest features/copy_generation/test_agent.py::test_stream_claude_yields_text_deltas_then_agent_result -v`
Expected: FAIL (`_stream_claude` not defined).

- [ ] **Step 2: GREEN — implement `_stream_claude`**

```python
# features/copy_generation/agent.py — add below _call_claude
def _stream_claude(methodology, user_prompt: str, n: int, model: str) -> Iterator[tuple[str, Any]]:
    """Yield ('token', str) during stream, then ('result', AgentResult) at end.

    Raises RuntimeError with full CLI output on any CLI or parse failure — no
    silent fallbacks (CLAUDE.md §2.7).
    """
    system_text = methodology.system_prompt_path.read_text(encoding="utf-8")
    cmd = [
        "claude", "-p", user_prompt,
        "--append-system-prompt", system_text,
        "--output-format", "stream-json",
        "--include-partial-messages", "--verbose",
        "--model", model,
    ]
    final_envelope: dict | None = None
    with subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, bufsize=1, env=_build_cli_env(),
    ) as proc:
        assert proc.stdout is not None
        for raw in proc.stdout:
            raw = raw.strip()
            if not raw:
                continue
            try:
                event = json.loads(raw)
            except json.JSONDecodeError as e:
                raise RuntimeError(
                    f"claude stream emitted non-JSON line for methodology "
                    f"{methodology.name!r}: {raw!r}"
                ) from e
            etype = event.get("type")
            if etype == "stream_event":
                inner = event.get("event", {})
                if inner.get("type") == "content_block_delta":
                    delta = inner.get("delta", {})
                    if delta.get("type") == "text_delta":
                        text = delta.get("text", "")
                        if text:
                            yield ("token", text)
            elif etype == "result":
                final_envelope = event
        try:
            proc.wait(timeout=_CLI_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired as e:
            proc.kill()
            raise RuntimeError(
                f"claude stream timed out after {_CLI_TIMEOUT_SECONDS}s "
                f"for methodology {methodology.name!r}"
            ) from e
        if proc.returncode != 0:
            stderr = proc.stderr.read() if proc.stderr else ""
            raise RuntimeError(
                f"claude CLI stream exited {proc.returncode} for methodology "
                f"{methodology.name!r}. stderr: {stderr!r}"
            )
    if final_envelope is None:
        raise RuntimeError(
            f"claude stream finished without a 'result' envelope for "
            f"methodology {methodology.name!r}"
        )
    yield ("result", _parse_cli_envelope(final_envelope, methodology, model))
```

Add `from typing import Any, Iterator` at top of `agent.py` if not already imported.

- [ ] **Step 3: Run test**

Run: `pytest features/copy_generation/test_agent.py::test_stream_claude_yields_text_deltas_then_agent_result -v`
Expected: PASS.

- [ ] **Step 4: Add error-case tests (same monkeypatch pattern)**

```python
def test_stream_claude_raises_on_missing_result_envelope(monkeypatch):
    # Only stream_event lines, no result envelope
    lines = ['{"type":"stream_event","event":{"type":"message_start"}}']
    # ... FakePopen as before ...
    monkeypatch.setattr("subprocess.Popen", lambda *a, **kw: FakePopen())
    with pytest.raises(RuntimeError, match="without a 'result' envelope"):
        list(agent._stream_claude(by_name("pas"), "p", n=1, model="x"))


def test_stream_claude_raises_on_non_zero_exit(monkeypatch):
    class FailingPopen(FakePopen):
        returncode = 2
        def wait(self, timeout=None): return 2
    # ... expect RuntimeError with "exited 2"


def test_stream_claude_raises_on_malformed_line(monkeypatch):
    lines = ["not-json"]
    # ... expect RuntimeError with "non-JSON line"
```

Run: `pytest features/copy_generation/test_agent.py -k stream_claude -v`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add features/copy_generation/agent.py features/copy_generation/test_agent.py
git commit -m "feat(copy_generation): _stream_claude emits tokens during CLI execution"
```

---

## Task 3: `real_stream_events` in `streaming.py`

**Files:**
- Modify: `features/copy_generation/streaming.py`
- Create: `features/copy_generation/test_streaming.py`

- [ ] **Step 1: RED — test SSE frame sequence matches dry-run contract**

```python
# features/copy_generation/test_streaming.py
from features.copy_generation.streaming import real_stream_events
from features.copy_generation.schema import Brief, CopyVariant, VariantAxes, AgentResult


def _fake_stream(variants):
    def _gen(*a, **kw):
        yield ("token", "[PAS v1] Los")
        yield ("token", "ing clients")
        yield ("result", AgentResult(
            run_id="abc", variants=variants, trace="t", trace_structured=[],
            methodology="pas", model="claude-sonnet-4-6",
            pipeline_version="copy_generation@test", seed=None,
            created_at="2026-04-19T12:00:00Z",
        ))
    return _gen


def test_real_stream_events_emits_expected_sse_sequence(monkeypatch):
    v = CopyVariant(id="V1", headline="H", primary_text="P", description="D",
                    ctas=["go"], confidence="high", confidence_score=0.9,
                    axes=VariantAxes(0.9, 0.8, 0.7), reasoning="r")
    import features.copy_generation.streaming as mod
    monkeypatch.setattr(mod, "_stream_claude", _fake_stream([v]))

    brief = Brief(product="p", audience="a", pain="pain text", ctas=["go"], social_proof=None)
    frames = list(real_stream_events(brief, methodology="pas", n=1, model="m"))

    # Each frame is "event: X\ndata: {...}\n\n"
    kinds = [f.split("\n")[0] for f in frames]
    assert kinds[0] == "event: run_start"
    assert "event: node_start" in kinds
    assert kinds.count("event: token") == 2
    assert "event: variant_done" in kinds
    assert kinds[-1] == "event: done"
```

Run: `pytest features/copy_generation/test_streaming.py -v`
Expected: FAIL (module or function missing).

- [ ] **Step 2: GREEN — implement `real_stream_events`**

```python
# features/copy_generation/streaming.py — add below dry_run_events
from features.copy_generation.agent import _stream_claude  # keep local if circular

def real_stream_events(
    brief: Brief, methodology: str, n: int, model: str
) -> Iterator[str]:
    """Mirror of dry_run_events backed by the real CLI stream.

    Preserves SSE event shape so the UI is truly agnostic (CLAUDE.md §2.3).
    """
    from features.copy_generation.methodologies import by_name
    m = by_name(methodology)
    user_prompt = m.build_user_prompt(brief, n=n)
    run_start = time.monotonic()

    # Placeholder run_id/pipeline_version — overwritten by final result. We emit
    # run_start immediately so the UI transitions out of "aguardando…" right away.
    yield sse("run_start", {
        "run_id": "pending", "pipeline_version": "pending",
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })
    yield sse("node_start", {"node_id": "brief", "label": "Briefing", "start_ms": 0})
    yield sse("node_done", {
        "node_id": "brief", "end_ms": 20, "tokens": 0,
        "confidence": None, "output_preview": brief.pain[:80],
    })
    yield sse("node_start", {"node_id": "agent", "label": "Agente criativo", "start_ms": 20})

    result: "AgentResult | None" = None
    token_count = 0
    for kind, payload in _stream_claude(m, user_prompt, n=n, model=model):
        if kind == "token":
            yield sse("token", {"node_id": "agent", "variant_id": None, "text": payload})
            token_count += 1
        elif kind == "result":
            result = payload

    if result is None:
        raise RuntimeError("_stream_claude exited without emitting a result")

    for v in result.variants:
        yield sse("variant_done", {
            **asdict(v), "axes": asdict(v.axes), "confidence_symbol": v.confidence_symbol,
        })
    yield sse("node_done", {
        "node_id": "agent",
        "end_ms": int((time.monotonic() - run_start) * 1000),
        "tokens": token_count, "confidence": None,
        "output_preview": result.variants[0].headline[:80] if result.variants else "",
    })
    yield sse("done", _serialize_result(result))
```

Run: `pytest features/copy_generation/test_streaming.py -v`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add features/copy_generation/streaming.py features/copy_generation/test_streaming.py
git commit -m "feat(copy_generation): real_stream_events mirrors dry-run SSE shape"
```

---

## Task 4: Swap `_replay_events` for `real_stream_events` in `api/generate.py`

**Files:**
- Modify: `features/web_gui/api/generate.py:198-228`
- Modify: `features/web_gui/test_server.py`

- [ ] **Step 1: RED — contract test for `/generate/stream` in real-mode**

```python
# features/web_gui/test_server.py — add test
def test_generate_stream_real_mode_emits_token_events(monkeypatch, tmp_path):
    """Real-mode path must emit `token` SSE frames during CLI execution."""
    import features.copy_generation.streaming as streaming_mod
    from features.copy_generation.schema import Brief, CopyVariant, VariantAxes, AgentResult

    v = CopyVariant(id="V1", headline="H", primary_text="P", description="D",
                    ctas=["go"], confidence="high", confidence_score=0.9,
                    axes=VariantAxes(0.9, 0.8, 0.7), reasoning="r")

    def fake_stream(*a, **kw):
        yield ("token", "chunk1 ")
        yield ("token", "chunk2")
        yield ("result", AgentResult(
            run_id="abc", variants=[v], trace="t", trace_structured=[],
            methodology="pas", model="x",
            pipeline_version="copy_generation@test",
            seed=None, created_at="2026-04-19T00:00:00Z",
        ))

    monkeypatch.setattr(streaming_mod, "_stream_claude", fake_stream)
    monkeypatch.setenv("VIBEWEB_DRY_RUN", "0")
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat-stub")  # unlock real path

    # Use existing ui_server / fixture; POST to /api/v1/generate/stream; collect body.
    # Assert body contains "event: token\n" AT LEAST twice, AND "event: done" at end.
```

Run test; expect FAIL because `_replay_events` currently calls `agent.generate()` not `_stream_claude`.

- [ ] **Step 2: GREEN — replace `_replay_events`**

```python
# features/web_gui/api/generate.py:198 — replace entire _replay_events body
def _replay_events(brief: Brief, payload: GenerateIn):
    """Real-mode SSE stream via claude --output-format stream-json (Task 9b)."""
    from features.copy_generation.streaming import real_stream_events
    yield from real_stream_events(
        brief, methodology=payload.methodology, n=payload.n_variants,
        model="claude-sonnet-4-6",
    )
```

Remove the unused imports (`asdict`, `time`, `_serialize_result`) if no longer referenced in this file.

Run: `pytest features/web_gui/test_server.py -k stream -v`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add features/web_gui/api/generate.py features/web_gui/test_server.py
git commit -m "feat(web_gui): /generate/stream real-mode uses stream-json CLI output"
```

---

## Task 5: Final verify + deploy

- [ ] **Step 1: Full local suite**

Run: `pytest -q`
Expected: all green. No regressions in existing 141+ tests.

- [ ] **Step 2: Lint / static**

Run: `python -m compileall features/ -q && cd features/web_gui/ui && npm run build`
Expected: clean compile, UI build passes (`tsconfig.app.json` has `noUnusedLocals: true`).

- [ ] **Step 3: Dry-run local smoke — confirm dry-run UNCHANGED**

Run: `VIBEWEB_DRY_RUN=1 VIBEWEB_REQUIRE_UI=1 python3 -m uvicorn features.web_gui.server:app --port 8765` in bg, hit `/generate/stream` via Playwright, diff SSE body against pre-9b baseline → identical shape.

- [ ] **Step 4: Deploy to VPS**

Run rsync deploy (`scripts/deploy-vps.sh` or existing pattern with `--exclude '.env' --exclude 'docker-compose.override.yml'` — per memory `project_vps_deploy_rsync_pitfall`).

- [ ] **Step 5: Production smoke**

Run `python3 /tmp/e2e_prod_flow.py` (existing) → still PASS.
Run new burst capture against prod → assert mid-stream screenshot shows non-empty token panel (not "aguardando agente…").

- [ ] **Step 6: Review Gate**

Invoke `pr-review-toolkit:review-pr` on the 4 commits. Fix anything flagged.

---

## MUST NOT CHANGE (regressions to guard against)

- `POST /generate` (non-streaming) — unchanged. `_call_claude` + `_parse_cli_envelope` preserve identical output.
- `dry_run_events` — bytes-for-bytes identical. Dry-run parity test (existing) must still pass.
- `NPQEL` stub — still raises `NotImplementedError` before any streaming.
- SSE event names and field shapes — `run_start`, `node_start`, `node_done`, `token`, `variant_done`, `done` — identical to pre-9b.
- Auth env stripping (`_build_cli_env`) — `_stream_claude` reuses it unchanged.
