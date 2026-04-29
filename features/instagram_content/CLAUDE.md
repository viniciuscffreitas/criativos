# Instagram Content Factory — Feature Context

Vertical slice that produces the v1 Instagram launch batch (27 PNGs at 1080×1350)
from HTML+CSS templates rendered via `scripts.pipeline`. Copy is hardcoded per
template; see the spec for the PAS-methodology rationale.

## Inputs
- `brand/tokens.css` — design tokens (colors, fonts, `--ig-handle`)
- `ads/assets/*.png` — site screenshots reused by `carousel-portfolio.html`

## Outputs
- `renders/*.png` — 27 deterministic renders (gitignored)
- `goldens/*.png` — committed regression baseline

## Non-obvious constraints
- All renders are 1080×1350 (4:5 portrait — 2026 IG default).
- Critical text must stay outside the top 60px and bottom 60px (safe-zone)
  because the 3:4 grid preview crops both bands.
- Carousels parameterize slide content via `?slide=1..7` query string.
- The `@vibeweb.eu` handle is a placeholder — change `--ig-handle` in
  `brand/tokens.css` to update everywhere.

## Publish runbook (manual, v1)
1. Run `python scripts/build.py --instagram`.
2. Inspect `features/instagram_content/renders/*.png` visually.
3. If layouts changed intentionally, copy the new PNGs into `goldens/` and commit.
4. Upload to Meta Business Suite Composer in **reverse order** (post 9 first
   → post 1 last) so newest-top-left grid order matches the spec.
5. For each carousel, upload slides 1..7 in order in a single carousel post.
6. Paste `bio.md` content into the Instagram bio (replace handle token if
   different from @vibeweb.eu).
7. Pin highlights in profile order: services → portfolio → about → contact → feed.
