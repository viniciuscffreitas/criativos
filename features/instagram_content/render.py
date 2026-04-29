"""
Render the v1 Instagram launch batch (27 PNGs).

Usage:
    python -m features.instagram_content.render
    # or via the unified CLI:
    python scripts/build.py --instagram
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from scripts.pipeline import run_jobs  # noqa: E402
from features.instagram_content.jobs import build_jobs, RENDERS_DIR  # noqa: E402


async def main() -> None:
    RENDERS_DIR.mkdir(parents=True, exist_ok=True)
    jobs = build_jobs()
    print(f"Rendering {len(jobs)} Instagram assets to {RENDERS_DIR}...")
    await run_jobs(jobs)
    failures: list[tuple[str, str]] = []
    for j in jobs:
        if j.out.exists() and j.out.stat().st_size > 0:
            print(f"  [OK] {j.out.name}")
        else:
            reason = "missing" if not j.out.exists() else "zero-byte"
            failures.append((j.out.name, reason))
            print(f"  [FAIL] {j.out.name} ({reason})")
    if failures:
        raise RuntimeError(
            f"Instagram render batch incomplete: {len(failures)}/{len(jobs)} "
            f"jobs produced no valid output: {failures}"
        )
    print(f"\nDone: {RENDERS_DIR.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())
