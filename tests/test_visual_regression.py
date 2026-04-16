"""
Regressao visual — compara renders atuais contra goldens.

Tolerancia: diffs de sub-pixel (antialias, kerning) passam; mudancas
reais de layout ou cor quebram o teste.
"""
from pathlib import Path

import pytest
from PIL import Image, ImageChops

ROOT = Path(__file__).parent.parent
GOLDENS = Path(__file__).parent / "goldens"

CASES = [
    (ROOT / "ads" / "renders" / "01-portfolio-grid.png", GOLDENS / "ad-portfolio-grid.png"),
    (ROOT / "brand" / "social" / "renders" / "instagram-post.png", GOLDENS / "social-instagram-post.png"),
    (ROOT / "brand" / "logos" / "vibeweb-primary.png", GOLDENS / "logo-primary.png"),
]

PIXEL_DIFF_THRESHOLD = 20       # soma R+G+B per-channel Manhattan
ALLOWED_DIFF_FRACTION = 0.01    # 1% dos pixels podem exceder


def _fraction_diff(a: Image.Image, b: Image.Image) -> float:
    a = a.convert("RGB")
    b = b.convert("RGB")
    assert a.size == b.size, f"size mismatch: {a.size} vs {b.size}"
    data = ImageChops.difference(a, b).tobytes()
    total = a.size[0] * a.size[1]
    over = sum(
        1 for i in range(0, len(data), 3)
        if data[i] + data[i + 1] + data[i + 2] > PIXEL_DIFF_THRESHOLD
    )
    return over / total


@pytest.mark.visual
@pytest.mark.parametrize(
    "current,golden",
    CASES,
    ids=[c[0].name for c in CASES],
)
def test_render_matches_golden(current, golden):
    if not current.exists():
        pytest.skip(f"Render missing: {current}")
    if not golden.exists():
        pytest.skip(f"Golden missing: {golden}")
    frac = _fraction_diff(Image.open(current), Image.open(golden))
    assert frac <= ALLOWED_DIFF_FRACTION, (
        f"Visual drift {frac*100:.2f}% > {ALLOWED_DIFF_FRACTION*100:.2f}% "
        f"for {current.name}. Re-render intencional? Atualize o golden."
    )
