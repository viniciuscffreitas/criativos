"""
FastAPI entry point — verbose route registration, no middleware magic.

Routes:
  /api/v1/projects                              (projects.py)
  /api/v1/projects/{slug}                       (projects.py)
  /api/v1/projects/{slug}/ads/{ad_id}/brief     [GET, PUT]  (briefs.py)
  /api/v1/projects/{slug}/creatives             [GET]       (creatives.py) ?kind= &status= filters
  /api/v1/generate                              [POST]      (generate.py)
  /api/v1/generate/stream                       [POST SSE]  (generate.py)
  /api/v1/variants/{run_id}/{variant_id}        [PATCH]     (variants.py)
  /api/v1/traces/{run_id}                       [GET]       (traces.py)
  /api/v1/assets/upload                         [POST]      (assets.py)

Mounted routes:
  /renders   StaticFiles — pre-rendered PNG creatives (renders_dir())
  /ui        StaticFiles — Vite build (static_dir()); gated by VIBEWEB_REQUIRE_UI=1
"""
from __future__ import annotations
import logging
import os
from fastapi import FastAPI
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from features.web_gui.api import assets, briefs, creatives, generate, projects, traces, variants
from features.web_gui.settings import renders_dir, static_dir, traces_dir, uploads_dir

_log = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title="Vibe Web Criativos", version="0.1.0")
    app.include_router(projects.router, prefix="/api/v1")
    app.include_router(briefs.router, prefix="/api/v1")
    app.include_router(creatives.router, prefix="/api/v1")
    app.include_router(generate.router, prefix="/api/v1")
    app.include_router(variants.router, prefix="/api/v1")
    app.include_router(traces.router, prefix="/api/v1")
    app.include_router(assets.router, prefix="/api/v1")

    @app.exception_handler(HTTPException)
    async def http_exc_handler(_, exc: HTTPException):
        detail = exc.detail if isinstance(exc.detail, dict) else {
            "error": str(exc.detail), "code": f"HTTP_{exc.status_code}",
        }
        return JSONResponse(status_code=exc.status_code, content=detail)

    # Ensure writable dirs exist at startup (fail-loud if creation impossible)
    for d in (traces_dir(), uploads_dir()):
        try:
            d.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            raise RuntimeError(f"failed to create {d}: {e}") from e

    sdir = static_dir()
    if sdir.exists():
        app.mount("/ui", StaticFiles(directory=str(sdir), html=True), name="ui")

        @app.get("/", include_in_schema=False)
        async def _root_to_ui():
            return RedirectResponse(url="/ui/", status_code=308)
    else:
        if os.getenv("VIBEWEB_REQUIRE_UI", "0") == "1":
            raise RuntimeError(
                f"VIBEWEB_REQUIRE_UI=1 but static dir not found: {sdir}"
            )
        _log.warning("Static dir %s not found — /ui will not be served", sdir)

    rdir = renders_dir()
    if rdir.exists():
        app.mount("/renders", StaticFiles(directory=str(rdir)), name="renders")
    else:
        if os.getenv("VIBEWEB_REQUIRE_RENDERS", "0") == "1":
            raise RuntimeError(f"renders dir not found: {rdir}")
        _log.warning("Renders dir %s not found — /renders will not be served", rdir)

    return app


# NOTE: module-level `app` exists for `uvicorn features.web_gui.server:app`.
# Tests MUST call `create_app()` directly — never `from ... import app` —
# so env/monkeypatch state applies to the store factory each test run.
app = create_app()
