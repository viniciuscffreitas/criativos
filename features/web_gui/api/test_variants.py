"""Colocated unit tests for api/variants.py — model validation."""
from __future__ import annotations

from features.web_gui.api.variants import VariantPatch


def test_variant_patch_exclude_none_drops_unset_fields():
    p = VariantPatch(selected=True)
    assert p.model_dump(exclude_none=True) == {"selected": True}


def test_variant_patch_all_none_produces_empty_dict():
    p = VariantPatch()
    assert p.model_dump(exclude_none=True) == {}


def test_variant_patch_approved_field():
    p = VariantPatch(approved=True)
    assert p.model_dump(exclude_none=True) == {"approved": True}
