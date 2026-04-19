"""
FastAPI entry point — verbose route registration, no middleware magic.

Routes:
  /api/v1/projects            (projects.py)
  /api/v1/projects/{slug}     (projects.py)
  [later tasks add]:
    /api/v1/projects/{slug}/ads/{ad_id}/brief        [GET, PUT]  (briefs.py)
    /api/v1/projects/{slug}/creatives                (creatives.py)
    /api/v1/generate          [POST]                 (generate.py)
    /api/v1/generate/stream   [POST SSE]             (generate.py)
    /api/v1/variants/{run_id}/{variant_id}  [PATCH]  (variants.py)
    /api/v1/traces/{run_id}                          (traces.py)
    /api/v1/assets/upload                            (assets.py)
"""
from __future__ import annotations
from fastapi import FastAPI
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from features.web_gui.api import projects
from features.web_gui.settings import static_dir


def create_app() -> FastAPI:
    app = FastAPI(title="Vibe Web Criativos", version="0.1.0")
    app.include_router(projects.router, prefix="/api/v1")

    @app.exception_handler(HTTPException)
    async def http_exc_handler(_, exc: HTTPException):
        detail = exc.detail if isinstance(exc.detail, dict) else {
            "error": str(exc.detail), "code": f"HTTP_{exc.status_code}",
        }
        return JSONResponse(status_code=exc.status_code, content=detail)

    sdir = static_dir()
    if sdir.exists():
        app.mount("/ui", StaticFiles(directory=str(sdir), html=True), name="ui")
    return app


app = create_app()
