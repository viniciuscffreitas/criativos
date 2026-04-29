"""
Declarative list of RenderJobs for the v1 Instagram launch batch.

Total: 27 PNGs = 6 single posts + 3 carousels × 7 slides each.

All renders are 1080×1350 (4:5 portrait, 2026 IG default).

Carousels parameterize slide content via ?slide=1..7 query string —
the carousel HTML reads location.search and switches the active slide.
"""
from __future__ import annotations

from pathlib import Path

from scripts.pipeline import RenderJob

FEATURE_DIR = Path(__file__).parent
TEMPLATES_DIR = FEATURE_DIR / "templates"
RENDERS_DIR = FEATURE_DIR / "renders"

W, H = 1080, 1350  # 4:5 portrait — 2026 IG default

SINGLES = (
    "single-manifesto",
    "single-cost-of-inaction",
    "single-niche-tag",
    "single-proof-number",
    "single-offer-mechanics",
    "single-cta-pure",
)

CAROUSELS: dict[str, int] = {
    "carousel-portfolio": 7,
    "carousel-services":  7,
    "carousel-process":   7,
}


def build_jobs() -> list[RenderJob]:
    jobs: list[RenderJob] = []
    for stem in SINGLES:
        jobs.append(RenderJob(
            source=TEMPLATES_DIR / f"{stem}.html",
            out=RENDERS_DIR / f"{stem}.png",
            width=W,
            height=H,
        ))
    for stem, n_slides in CAROUSELS.items():
        for i in range(1, n_slides + 1):
            jobs.append(RenderJob(
                source=TEMPLATES_DIR / f"{stem}.html",
                out=RENDERS_DIR / f"{stem}-slide-{i}.png",
                width=W,
                height=H,
                query=f"?slide={i}",
            ))
    return jobs
