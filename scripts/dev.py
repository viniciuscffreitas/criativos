"""
Local dev orchestrator: uvicorn (backend) + vite (ui) side by side.

- uvicorn on :8000 with --reload
- vite dev server on :5173, proxies /api/* and /renders/* to :8000

Ctrl+C kills both cleanly. If either process exits on its own (crash,
kill from elsewhere), we shut the other one down and exit non-zero —
a half-running dev environment is worse than none (§2.7 no silent
fallbacks: a dead backend with a live frontend makes requests fail in
confusing ways, so surface the failure loudly).

VIBEWEB_DRY_RUN defaults to "1" here so the local dev loop does not
hit the Anthropic API by accident. Set VIBEWEB_DRY_RUN=0 explicitly
to run against the real API.
"""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent.parent
UI_DIR = ROOT / "features" / "web_gui" / "ui"


def main() -> int:
    env = dict(os.environ)
    env.setdefault("VIBEWEB_DRY_RUN", "1")

    print("[dev] starting backend on :8000 (VIBEWEB_DRY_RUN=%s)" % env["VIBEWEB_DRY_RUN"])
    backend = subprocess.Popen(
        [sys.executable, "-m", "uvicorn",
         "features.web_gui.server:app",
         "--reload", "--port", "8000"],
        cwd=str(ROOT), env=env,
    )

    print("[dev] starting vite ui on :5173 (served at http://localhost:5173/ui/)")
    frontend = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=str(UI_DIR), env=env,
    )

    shutting_down = False

    def shutdown(*_: object) -> None:
        nonlocal shutting_down
        if shutting_down:
            return
        shutting_down = True
        print("\n[dev] shutting down...")
        for proc in (backend, frontend):
            if proc.poll() is None:
                proc.terminate()
        # Give each process up to 5s to exit cleanly; kill if it doesn't.
        for proc in (backend, frontend):
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()

    signal.signal(signal.SIGINT, lambda *_: shutdown())
    signal.signal(signal.SIGTERM, lambda *_: shutdown())

    # Poll both processes. If either dies, take the other down with it so
    # the user sees a coherent exit rather than a silently-orphaned half.
    try:
        while True:
            backend_rc = backend.poll()
            frontend_rc = frontend.poll()
            if backend_rc is not None:
                print(f"[dev] backend exited with code {backend_rc}")
                shutdown()
                return backend_rc or 1
            if frontend_rc is not None:
                print(f"[dev] frontend exited with code {frontend_rc}")
                shutdown()
                return frontend_rc or 1
            time.sleep(0.5)
    except KeyboardInterrupt:
        shutdown()
        return 0


if __name__ == "__main__":
    sys.exit(main())
