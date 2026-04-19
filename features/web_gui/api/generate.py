"""
Generate route — POST /api/v1/generate.

Resolves project + ad, builds a Brief, calls agent.generate(), persists
variants + trace metadata to ads.yaml (when persist=True), and ALWAYS saves
the full trace JSON via trace_store.

Routes:
  POST /api/v1/generate
"""
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from features.copy_generation import agent
from features.copy_generation.schema import Brief
from features.web_gui.api._helpers import resolve_ads_path
from features.web_gui.services import trace_store, yaml_rw

router = APIRouter(tags=["generate"])

# Lists methodologies whose prompts + parsers are fully wired. Registered-but-stubbed
# ones (e.g. NPQEL) live in copy_generation/methodologies/__init__.py but raise
# NotImplementedError; this gate converts those to 501 before the agent is invoked.
# Keep in sync with the registry when a methodology graduates from stub to live.
IMPLEMENTED_METHODOLOGIES: frozenset[str] = frozenset({"pas"})


class GenerateIn(BaseModel):
    project_slug: str
    ad_id: str
    methodology: str
    n_variants: int = 3
    brief_overrides: dict | None = None
    persist: bool = True


class _AdNotFound(Exception):
    """Raised inside a yaml_rw.modify callback when the target ad_id is missing.
    Caller translates to HTTPException 404 — keeps yaml_rw HTTP-agnostic."""


def _find_ad_key(ads_data: dict, ad_id: str) -> str:
    for key, ad in ads_data.get("ads", {}).items():
        if ad.get("id") == ad_id:
            return key
    raise HTTPException(
        status_code=404,
        detail={"error": f"ad {ad_id!r} not found in project", "code": "AD_NOT_FOUND"},
    )


@router.post("/generate")
def post_generate(payload: GenerateIn):
    # 1. Check methodology is implemented before any I/O.
    if payload.methodology not in IMPLEMENTED_METHODOLOGIES:
        raise HTTPException(
            status_code=501,
            detail={
                "error": (
                    f"methodology {payload.methodology!r} is not implemented; "
                    f"available: {sorted(IMPLEMENTED_METHODOLOGIES)}"
                ),
                "code": "METHODOLOGY_NOT_IMPLEMENTED",
            },
        )

    # 2. Resolve project → ads_path.
    ads_path = resolve_ads_path(payload.project_slug)

    # 3. Load ads YAML, find ad by id.
    ads_data = yaml_rw.read(ads_path)
    key = _find_ad_key(ads_data, payload.ad_id)
    ad = ads_data["ads"][key]

    # 4. Extract brief, merge overrides.
    raw_brief = ad.get("brief")
    if raw_brief is None:
        raise HTTPException(
            status_code=404,
            detail={"error": f"ad {payload.ad_id!r} has no brief", "code": "BRIEF_NOT_FOUND"},
        )
    if payload.brief_overrides:
        raw_brief = {**raw_brief, **payload.brief_overrides}

    # 5. Construct Brief — maps KeyError (missing field) and ValueError (empty ctas)
    # to a single 400 BRIEF_INVALID contract so callers never see an opaque 500.
    try:
        brief = Brief(
            product=raw_brief["product"],
            audience=raw_brief["audience"],
            pain=raw_brief["pain"],
            ctas=raw_brief.get("ctas") or [],
            social_proof=raw_brief.get("social_proof"),
        )
    except KeyError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "error": f"brief missing required field: {exc.args[0]!r}",
                "code": "BRIEF_INVALID",
                "raw": str(exc),
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": str(exc), "code": "BRIEF_INVALID", "raw": str(exc)},
        ) from exc

    # 6. Call the agent. NotImplementedError surfaces for stubs like NPQEL
    # even though we gate at step 1 — leave as an unhandled 500 for anything
    # that slips through (defensive). KeyError for unknown methodology is
    # already handled above, so this path is unreachable in normal flow.
    result = agent.generate(brief, methodology=payload.methodology, n=payload.n_variants)

    # 7. Serialize variants.
    serialized_variants = [
        {**asdict(v), "axes": asdict(v.axes), "confidence_symbol": v.confidence_symbol}
        for v in result.variants
    ]
    serialized = {
        "run_id": result.run_id,
        "variants": serialized_variants,
        "trace": result.trace,
        "trace_structured": [asdict(t) for t in result.trace_structured],
        "methodology": result.methodology,
        "model": result.model,
        "pipeline_version": result.pipeline_version,
        "seed": result.seed,
        "created_at": result.created_at,
    }

    # 8. Save trace ALWAYS (regardless of persist flag).
    trace_store.save(result.run_id, serialized)

    # 9. Persist variants + trace metadata to ads.yaml when requested.
    if payload.persist:
        def _mutate(data: dict) -> dict:
            for k, ad_entry in data.get("ads", {}).items():
                if ad_entry.get("id") == payload.ad_id:
                    data["ads"][k]["variants"] = serialized_variants
                    if "trace" not in data["ads"][k]:
                        data["ads"][k]["trace"] = {}
                    data["ads"][k]["trace"]["last_run"] = result.run_id
                    data["ads"][k]["trace"]["confidence"] = (
                        result.variants[0].confidence_score if result.variants else None
                    )
                    return data
            raise _AdNotFound(payload.ad_id)

        try:
            yaml_rw.modify(ads_path, _mutate)
        except _AdNotFound as exc:
            raise HTTPException(
                status_code=404,
                detail={"error": f"ad {str(exc)!r} not found in project", "code": "AD_NOT_FOUND"},
            ) from exc

    # 10. Return serialized result.
    return serialized
