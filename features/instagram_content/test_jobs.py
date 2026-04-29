"""
Contract tests for jobs.py — declarative 27-job list.

These tests lock the count, dimensions, and carousel-query contracts.
They run fast (pure Python, no I/O, no Playwright).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from features.instagram_content.jobs import build_jobs  # noqa: E402


# ---------- Job declaration contract ---------------------------------------

def test_job_count_locked():
    """Spec §6 declares 27 renders. Anything else is a contract change."""
    jobs = build_jobs()
    assert len(jobs) == 27, f"expected 27 jobs, got {len(jobs)}"


def test_jobs_all_target_4_5_portrait():
    """All v1 IG renders are 1080×1350. Square or 9:16 leaks belong elsewhere."""
    for j in build_jobs():
        assert (j.width, j.height) == (1080, 1350), (
            f"job {j.out.name} has dimensions {j.width}x{j.height}, expected 1080x1350"
        )


def test_carousel_jobs_have_slide_query():
    jobs = [j for j in build_jobs() if "carousel-" in j.out.name]
    assert len(jobs) == 21, f"expected 21 carousel slides, got {len(jobs)}"
    for j in jobs:
        assert j.query.startswith("?slide="), (
            f"{j.out.name} missing ?slide= query (got {j.query!r})"
        )
