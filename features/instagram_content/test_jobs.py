"""
Contract tests for jobs.py — declarative 48-job list.

Three IG-native dimensions:
  - 27 grid posts at 1080×1350 (singles + carousel slides)
  -  1 avatar      at 1080×1080
  - 20 stories     at 1080×1920 (5 highlight covers + 15 starter stories)

Tests run fast (pure Python, no I/O, no Playwright).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from features.instagram_content.jobs import build_jobs  # noqa: E402

GRID_POST = (1080, 1350)
AVATAR    = (1080, 1080)
STORY     = (1080, 1920)


def test_job_count_locked():
    """27 grid + 1 avatar + 5 highlight covers + 15 starter stories = 48."""
    jobs = build_jobs()
    assert len(jobs) == 48, f"expected 48 jobs, got {len(jobs)}"


def test_grid_posts_count_and_size():
    """6 singles + 3 carousels × 7 slides = 27 grid posts at 1080×1350."""
    grid = [
        j for j in build_jobs()
        if j.out.name.startswith(("single-", "carousel-"))
    ]
    assert len(grid) == 27, f"expected 27 grid posts, got {len(grid)}"
    for j in grid:
        assert (j.width, j.height) == GRID_POST, (
            f"grid job {j.out.name} has {j.width}x{j.height}, expected {GRID_POST}"
        )


def test_avatar_present_and_square():
    """One profile avatar at 1080×1080."""
    avatars = [j for j in build_jobs() if j.out.name == "account-avatar.png"]
    assert len(avatars) == 1, f"expected 1 avatar, got {len(avatars)}"
    j = avatars[0]
    assert (j.width, j.height) == AVATAR, (
        f"avatar has {j.width}x{j.height}, expected {AVATAR}"
    )


def test_highlight_covers_count_and_size():
    """5 highlight covers at 1080×1920 with ?type= query."""
    covers = [j for j in build_jobs() if j.out.name.startswith("highlight-cover-")]
    assert len(covers) == 5, f"expected 5 highlight covers, got {len(covers)}"
    for j in covers:
        assert (j.width, j.height) == STORY, (
            f"cover {j.out.name} has {j.width}x{j.height}, expected {STORY}"
        )
        assert j.query.startswith("?type="), (
            f"{j.out.name} missing ?type= query (got {j.query!r})"
        )


def test_starter_stories_count_and_size():
    """15 starter stories at 1080×1920 (3 per highlight × 5 highlights)."""
    stories = [j for j in build_jobs() if j.out.name.startswith("story-starter-")]
    assert len(stories) == 15, f"expected 15 starter stories, got {len(stories)}"
    for j in stories:
        assert (j.width, j.height) == STORY, (
            f"story {j.out.name} has {j.width}x{j.height}, expected {STORY}"
        )
        assert j.query.startswith("?slot="), (
            f"{j.out.name} missing ?slot= query (got {j.query!r})"
        )


def test_carousel_jobs_have_slide_query():
    jobs = [j for j in build_jobs() if "carousel-" in j.out.name]
    assert len(jobs) == 21, f"expected 21 carousel slides, got {len(jobs)}"
    for j in jobs:
        assert j.query.startswith("?slide="), (
            f"{j.out.name} missing ?slide= query (got {j.query!r})"
        )
