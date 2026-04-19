"""
Session-scoped fixture that boots a real uvicorn server for e2e tests.

Starts on port 8765 with VIBEWEB_DRY_RUN=1 so the SSE stream runs without
hitting the Anthropic API. Raises clearly on timeout rather than yielding an
unready server (§2.7 no silent fallbacks).
"""
from __future__ import annotations

import os
import subprocess
import sys
import time

import httpx
import pytest

_PORT = 8765
_READY_URL = f"http://localhost:{_PORT}/api/v1/projects"
_TIMEOUT_S = 15


@pytest.fixture(scope="session")
def ui_server():
    env = {**os.environ, "VIBEWEB_DRY_RUN": "1"}
    proc = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn",
            "features.web_gui.server:app",
            "--host", "127.0.0.1",
            "--port", str(_PORT),
            "--log-level", "warning",
        ],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    deadline = time.monotonic() + _TIMEOUT_S
    last_exc: Exception | None = None
    while time.monotonic() < deadline:
        try:
            r = httpx.get(_READY_URL, timeout=2.0)
            if r.status_code < 500:
                break
        except Exception as exc:
            last_exc = exc
        time.sleep(0.5)
    else:
        proc.terminate()
        proc.wait(timeout=5)
        raise RuntimeError(
            f"uvicorn failed to respond within {_TIMEOUT_S}s on :{_PORT}. "
            f"Last error: {last_exc}"
        )

    base_url = f"http://localhost:{_PORT}"
    try:
        yield base_url
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
