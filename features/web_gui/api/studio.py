"""Studio routes — conversational entry-point for the asset pipeline.

POST /api/v1/studio/request    (SSE)
    Body: {"prompt": str, "n_variants": int = 3}
    Response: text/event-stream emitting the studio_agent.orchestrator
    event vocabulary (run_start, node_start, node_done, plan_decided,
    variant_done, render_progress, done, error).
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from features.studio_agent import orchestrator
from features.studio_agent.schema import StudioRequest

router = APIRouter(prefix="/studio", tags=["studio"])


class _StudioBody(BaseModel):
    prompt: str = Field(..., min_length=1)
    n_variants: int = Field(default=3, ge=1, le=8)


@router.post("/request")
def post_request(body: _StudioBody):
    try:
        req = StudioRequest(prompt=body.prompt, n_variants=body.n_variants)
    except ValueError as e:
        # StudioRequest also rejects whitespace-only strings, which Pydantic's
        # min_length=1 doesn't catch. Surface as 400 with our standard
        # {error, code} envelope (Pydantic field errors come through as 422).
        raise HTTPException(
            status_code=400,
            detail={"error": str(e), "code": "INVALID_REQUEST"},
        ) from e

    async def _gen():
        async for chunk in orchestrator.stream(req):
            yield chunk

    return StreamingResponse(_gen(), media_type="text/event-stream")
