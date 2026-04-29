"""
Declarative list of RenderJobs for the v1 Instagram launch.

Total: 48 PNGs split across 3 IG-native sizes:
  - 27 grid posts at 1080×1350 (6 singles + 3 carousels × 7 slides)
  - 1 profile avatar at 1080×1080
  - 20 stories at 1080×1920 (5 highlight covers + 15 starter stories
    that go INSIDE the highlights so they aren't empty on day 1)

Carousels parameterize slide content via ?slide=1..7. Highlight covers
parameterize via ?type=services|portfolio|about|contact|feed. Starter
stories parameterize via ?slot=<highlight>-<index>.
"""
from __future__ import annotations

from pathlib import Path

from scripts.pipeline import RenderJob

FEATURE_DIR = Path(__file__).parent
TEMPLATES_DIR = FEATURE_DIR / "templates"
RENDERS_DIR = FEATURE_DIR / "renders"

# IG-native dimensions
GRID_POST = (1080, 1350)  # 4:5 portrait — feed grid posts
AVATAR    = (1080, 1080)  # 1:1 — profile picture (IG circle-crops on display)
STORY     = (1080, 1920)  # 9:16 — stories, highlight covers, story-starters

# Backwards-compat alias for tests reading the historical pair.
W, H = GRID_POST

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

# Highlight covers (5 — one per pinned highlight, IG circle-crops at center).
HIGHLIGHT_TYPES = (
    "services",
    "portfolio",
    "about",
    "contact",
    "feed",
)

# Starter stories that land INSIDE each highlight so they aren't empty on
# day 1. 3 stories per highlight × 5 highlights = 15 stories.
STARTER_STORY_SLOTS = (
    "services-1", "services-2", "services-3",
    "portfolio-1", "portfolio-2", "portfolio-3",
    "about-1", "about-2", "about-3",
    "contact-1", "contact-2", "contact-3",
    "feed-1", "feed-2", "feed-3",
)


def build_jobs() -> list[RenderJob]:
    jobs: list[RenderJob] = []

    # Grid posts (27 PNGs at 1080×1350).
    gw, gh = GRID_POST
    for stem in SINGLES:
        jobs.append(RenderJob(
            source=TEMPLATES_DIR / f"{stem}.html",
            out=RENDERS_DIR / f"{stem}.png",
            width=gw, height=gh,
        ))
    for stem, n_slides in CAROUSELS.items():
        for i in range(1, n_slides + 1):
            jobs.append(RenderJob(
                source=TEMPLATES_DIR / f"{stem}.html",
                out=RENDERS_DIR / f"{stem}-slide-{i}.png",
                width=gw, height=gh,
                query=f"?slide={i}",
            ))

    # Profile avatar (1 PNG at 1080×1080).
    aw, ah = AVATAR
    jobs.append(RenderJob(
        source=TEMPLATES_DIR / "account-avatar.html",
        out=RENDERS_DIR / "account-avatar.png",
        width=aw, height=ah,
    ))

    # Highlight covers + starter stories (1080×1920).
    sw, sh = STORY
    for htype in HIGHLIGHT_TYPES:
        jobs.append(RenderJob(
            source=TEMPLATES_DIR / "highlight-cover.html",
            out=RENDERS_DIR / f"highlight-cover-{htype}.png",
            width=sw, height=sh,
            query=f"?type={htype}",
        ))
    for slot in STARTER_STORY_SLOTS:
        jobs.append(RenderJob(
            source=TEMPLATES_DIR / "story-starter.html",
            out=RENDERS_DIR / f"story-starter-{slot}.png",
            width=sw, height=sh,
            query=f"?slot={slot}",
        ))

    # Preflight: every declared template must exist on disk. Otherwise Playwright
    # silently captures a Chromium error page as the render. Spec §10 contract:
    # "Missing template file → FileNotFoundError with full path; no fallback."
    missing = sorted({j.source for j in jobs if not j.source.exists()})
    if missing:
        raise FileNotFoundError(
            "Instagram templates missing — fix SINGLES/CAROUSELS/HIGHLIGHT_TYPES/"
            "STARTER_STORY_SLOTS in jobs.py or create the templates: "
            f"{[str(p) for p in missing]}"
        )
    return jobs
