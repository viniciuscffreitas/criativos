"""
Session-scoped fixture that boots a real uvicorn server for e2e tests.

Starts on port 8765 with VIBEWEB_DRY_RUN=1 so the SSE stream runs without
hitting the Anthropic API. Raises clearly on timeout rather than yielding an
unready server (§2.7 no silent fallbacks).

Snapshots config/ads.yaml around the session — the e2e flow's "Próximo"
button persists the brief via PUT /briefs, and YAML round-trip reorders keys
on write. Without the restore, every e2e run would show ads.yaml as dirty.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest

_PORT = 8765
_READY_URL = f"http://localhost:{_PORT}/api/v1/projects"
_TIMEOUT_S = 15
_ADS_YAML = Path(__file__).parent.parent.parent / "config" / "ads.yaml"


@pytest.fixture(scope="session")
def ui_server():
    # Snapshot ads.yaml so the session's PUT /briefs writes don't mutate the
    # tracked file (§2.9 cleanliness: tests don't leave trash behind).
    ads_snapshot = _ADS_YAML.read_bytes()

    env = {**os.environ, "VIBEWEB_DRY_RUN": "1"}
    # stderr→stdout merges streams onto one pipe so we can drain (and include)
    # everything uvicorn emitted if the readiness check fails. Without draining,
    # a full pipe buffer would hang the subprocess and make the timeout misleading.
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
        stderr=subprocess.STDOUT,
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
        try:
            captured, _ = proc.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            captured, _ = proc.communicate()
        raise RuntimeError(
            f"uvicorn failed to respond within {_TIMEOUT_S}s on :{_PORT}. "
            f"Last error: {last_exc}\n"
            f"Uvicorn output:\n{captured.decode(errors='replace')}"
        )

    base_url = f"http://localhost:{_PORT}"
    try:
        yield base_url
    finally:
        proc.terminate()
        # communicate() drains the stdout pipe so the subprocess can exit cleanly
        # — otherwise a full pipe buffer (e.g., accumulated request logs) would
        # deadlock the shutdown.
        try:
            proc.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.communicate()
        # Restore ads.yaml — the flow persists the brief and YAML rewrite reorders keys.
        _ADS_YAML.write_bytes(ads_snapshot)
