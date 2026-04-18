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

_ADS = ROOT / "ads" / "renders"
_SOCIAL = ROOT / "brand" / "social" / "renders"
_LOGOS = ROOT / "brand" / "logos"

CASES = [
    # Ads — all 6 creatives. Dimension check misses layout drift; goldens catch it.
    (_ADS / "01-portfolio-grid.png",  GOLDENS / "ad-portfolio-grid.png"),
    (_ADS / "02-before-after.png",    GOLDENS / "ad-before-after.png"),
    (_ADS / "03-social-proof.png",    GOLDENS / "ad-social-proof.png"),
    (_ADS / "04-price-objection.png", GOLDENS / "ad-price-objection.png"),
    (_ADS / "05-mockup-showcase.png", GOLDENS / "ad-mockup-showcase.png"),
    (_ADS / "06-niche-designers.png", GOLDENS / "ad-niche-designers.png"),
    # Social — one per distinct template (post, story, highlight, linkedin, og).
    (_SOCIAL / "instagram-post.png",                 GOLDENS / "social-instagram-post.png"),
    (_SOCIAL / "instagram-story.png",                GOLDENS / "social-instagram-story.png"),
    (_SOCIAL / "instagram-highlight-about.png",      GOLDENS / "social-instagram-highlight-about.png"),
    (_SOCIAL / "instagram-highlight-contact.png",    GOLDENS / "social-instagram-highlight-contact.png"),
    (_SOCIAL / "instagram-highlight-feed.png",       GOLDENS / "social-instagram-highlight-feed.png"),
    (_SOCIAL / "instagram-highlight-portfolio.png",  GOLDENS / "social-instagram-highlight-portfolio.png"),
    (_SOCIAL / "instagram-highlight-services.png",   GOLDENS / "social-instagram-highlight-services.png"),
    (_SOCIAL / "linkedin-banner.png",                GOLDENS / "social-linkedin-banner.png"),
    (_SOCIAL / "og-image.png",                       GOLDENS / "social-og-image.png"),
    # Logos
    (_LOGOS / "vibeweb-primary.png", GOLDENS / "logo-primary.png"),
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
