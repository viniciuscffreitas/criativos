"""Variants route — PATCH /api/v1/variants/{run_id}/{variant_id}.

Finds the ad whose trace.last_run == run_id across all projects, then patches
the matching variant in place via an atomic yaml_rw.modify().

Routes:
  PATCH /api/v1/variants/{run_id}/{variant_id}
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from features.web_gui.api._helpers import iter_ads_paths
from features.web_gui.services import yaml_rw

router = APIRouter(tags=["variants"])


class VariantPatch(BaseModel):
    selected: bool | None = None
    headline: str | None = None
    primary_text: str | None = None
    description: str | None = None
    ctas: list[str] | None = None


@router.patch("/variants/{run_id}/{variant_id}")
def patch_variant(run_id: str, variant_id: str, payload: VariantPatch):
    patch = payload.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(
            status_code=400,
            detail={"error": "patch payload is empty", "code": "EMPTY_PATCH"},
        )

    for _slug, ads_path in iter_ads_paths():
        try:
            ads_data = yaml_rw.read(ads_path)
        except FileNotFoundError as exc:
            raise HTTPException(
                status_code=500,
                detail={
                    "error": f"ads file referenced by projects.yaml not found on disk: {ads_path}",
                    "code": "ADS_FILE_NOT_FOUND",
                },
            ) from exc

        # Find the ad whose last_run matches our run_id.
        target_key: str | None = None
        for key, ad in ads_data.get("ads", {}).items():
            if ad.get("trace", {}).get("last_run") == run_id:
                target_key = key
                break

        if target_key is None:
            continue

        # Ad found for this run_id — now look for the variant.
        # Use a one-element list as a mutable carrier so we can return from
        # the mutate fn (triggering the yaml_rw write) while still surfacing
        # the patched variant to the outer scope.
        result_carrier: list[dict] = []

        def _mutate(data: dict) -> dict:
            raw_variants = data["ads"][target_key].get("variants")
            if raw_variants is None:
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error": f"ad {target_key!r} has no variants list (ads.yaml malformed)",
                        "code": "ADS_VARIANTS_MISSING",
                    },
                )
            variants = raw_variants
            for i, v in enumerate(variants):
                if v.get("id") == variant_id:
                    patched = {**v, **patch}
                    data["ads"][target_key]["variants"][i] = patched
                    result_carrier.append(patched)
                    return data
            # Variant not found — return data unchanged; caller checks carrier.
            return data

        yaml_rw.modify(ads_path, _mutate)

        if result_carrier:
            return result_carrier[0]

        # Ad found for run_id but variant_id not in variants.
        raise HTTPException(
            status_code=404,
            detail={
                "error": f"variant {variant_id!r} not found in run {run_id!r}",
                "code": "VARIANT_NOT_FOUND",
            },
        )

    raise HTTPException(
        status_code=404,
        detail={
            "error": f"no variant found for run_id {run_id!r}",
            "code": "VARIANT_NOT_FOUND",
        },
    )
