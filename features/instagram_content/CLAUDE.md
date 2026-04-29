# Instagram Content Factory — Feature Context

Vertical slice that produces the **complete v1 Instagram launch** (48 PNGs)
from HTML+CSS templates rendered via `scripts.pipeline`. Copy is hardcoded per
template; see the spec for the PAS-methodology rationale.

For the full publish runbook (humans), read `PUBLISH.md` in this directory.

## Inputs
- `brand/tokens.css` — design tokens (colors, fonts, `--ig-handle`)
- `ads/assets/*.png` — site screenshots reused by `carousel-portfolio.html`

## Outputs (48 PNGs across 3 IG-native sizes)
- `renders/*.png` — gitignored, regenerable
- `goldens/*.png` — committed regression baseline

| Category | Count | Size | Template |
|---|---:|---|---|
| Profile avatar | 1 | 1080×1080 | `account-avatar.html` |
| Highlight covers | 5 | 1080×1920 | `highlight-cover.html?type=…` |
| Starter stories (3 per highlight × 5) | 15 | 1080×1920 | `story-starter.html?slot=…` |
| Grid singles | 6 | 1080×1350 | `single-*.html` |
| Carousel slides (3 carousels × 7) | 21 | 1080×1350 | `carousel-*.html?slide=N` |

## Non-obvious constraints
- 3 dimensions in play: GRID_POST (1080×1350), AVATAR (1080×1080), STORY (1080×1920).
- Critical text in grid posts must stay outside top/bottom 60px (3:4 grid crop).
  Stories and avatar use the same 60px lower-bound but are NOT crop-affected.
- Carousels parameterize slides via `?slide=1..7`. Each has a `?slide=99`
  guard that fails loud (RENDER ERROR pre) so misconfiguration doesn't
  silently produce blank PNGs.
- `?type=…` for highlight covers, `?slot=…` for starter stories.
- The `@vibeweb.eu` handle lives in `brand/tokens.css --ig-handle`. One-line
  change updates every cover, story, and bottom-of-post handle line.
- 3 carousels split CSS into sibling `.css` files (file-size rule >600 lines).
  Tokens-truth tests follow `<link>` to read sibling CSS — see
  `tests/test_tokens_truth.py::_stylesheet_text_for`.

## Publish runbook
See `PUBLISH.md` (single source of truth, includes account-setup checklist,
upload sequences, pin order, caption templates, KPI targets, brand voice
quick-ref).
