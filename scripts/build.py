#!/usr/bin/env python3
"""
Vibe Web unified asset pipeline.

Usage:
    python scripts/build.py --all        # brand + ads
    python scripts/build.py --brand      # logos, social, favicons
    python scripts/build.py --ads        # ad creatives only
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def main() -> int:
    parser = argparse.ArgumentParser(description="Vibe Web asset pipeline")
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--brand", action="store_true", help="Generate brand pack (logos, social, favicons)")
    g.add_argument("--ads", action="store_true", help="Render ad creatives")
    g.add_argument("--all", action="store_true", help="Run the full pipeline")
    args = parser.parse_args()

    if args.brand or args.all:
        from scripts.generate import main as gen_main
        asyncio.run(gen_main())
    if args.ads or args.all:
        from ads.render import main as ads_main
        asyncio.run(ads_main())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
