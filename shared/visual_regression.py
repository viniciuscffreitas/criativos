"""Perceptual diff thresholds shared across visual-regression tests.

Two consumers today: `tests/test_visual_regression.py` (legacy, brand+ads) and
`features/instagram_content/test_render.py`. Future visual-test consumers
should import from here rather than duplicate the constants.

The thresholds tolerate sub-pixel antialiasing + font kerning drift while
catching real layout/color regressions.
"""
from __future__ import annotations

# Manhattan sum (R+G+B per-pixel diff) above which a pixel is "different."
PIXEL_DIFF_THRESHOLD = 20

# Fraction of pixels permitted to exceed PIXEL_DIFF_THRESHOLD.
ALLOWED_DIFF_FRACTION = 0.01
