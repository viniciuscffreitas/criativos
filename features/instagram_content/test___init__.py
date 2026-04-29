"""Smoke test: instagram_content package is importable and carries its spec reference."""
import features.instagram_content as pkg


def test_package_importable():
    assert pkg is not None


def test_package_docstring_references_spec():
    assert "instagram-content-factory" in (pkg.__doc__ or ""), (
        "Package docstring must reference the spec file"
    )
