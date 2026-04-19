"""Colocated unit tests for api/assets.py — constants and allowlist."""
from __future__ import annotations

from features.web_gui.api.assets import _ALLOWED_MIME, _MAX_BYTES


def test_max_bytes_is_10mb():
    assert _MAX_BYTES == 10 * 1024 * 1024


def test_allowed_mime_contains_expected_types():
    assert "image/png" in _ALLOWED_MIME
    assert "image/jpeg" in _ALLOWED_MIME
    assert "image/svg+xml" in _ALLOWED_MIME
    assert "application/pdf" in _ALLOWED_MIME
    assert "video/mp4" in _ALLOWED_MIME


def test_exe_not_in_allowed_mime():
    assert "application/octet-stream" not in _ALLOWED_MIME
    assert "application/x-msdownload" not in _ALLOWED_MIME
