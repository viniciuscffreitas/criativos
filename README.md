# Vibe Web

Brand identity, marketing materials, and ad creatives for Vibe Web.

## Structure

```
vibeweb/
├── brand/              Brand identity system
│   ├── tokens.css      Design tokens (single source of truth — import from any template)
│   ├── guidelines.html Brand guidelines page (open in browser)
│   ├── guidelines.css  Guidelines page styling
│   ├── logos/          Logo variants (SVG sources + PNG renders)
│   ├── favicons/       Favicons (rendered natively from SVG at each size)
│   └── social/
│       ├── templates/  HTML templates (Instagram post/story/highlight, LinkedIn, OG)
│       └── renders/    Generated PNG outputs
│
├── ads/                Meta Ads creatives (1080×1080)
│   ├── templates/      6 HTML ad templates — all import ../../brand/tokens.css
│   ├── assets/         Device mockups (iPhone, MacBook) + site screenshots
│   ├── renders/        Generated PNGs (upload these to Meta Ads Manager)
│   ├── copy.md         Primary text / headline / description for each ad
│   └── render.py       Thin wrapper calling scripts.pipeline
│
├── scripts/
│   ├── pipeline.py     Shared Playwright helpers (document.fonts.ready)
│   ├── generate.py     Brand asset generator (logos, social, favicons)
│   └── build.py        Unified CLI — entrypoint
│
└── tests/
    ├── conftest.py
    ├── goldens/                Reference images for visual regression
    ├── test_packaging.py       pyproject.toml is pinned
    ├── test_pipeline.py        Shared helpers unit tests
    ├── test_tokens_truth.py    Tokens.css is the real source of truth
    ├── test_generate.py        Brand asset structural + integration tests
    ├── test_build_cli.py       Unified CLI smoke tests
    └── test_visual_regression.py  Perceptual diff against goldens
```

## Install

```bash
pip install -e ".[dev]"
playwright install chromium
```

`pyproject.toml` pins `playwright`, `pillow`, `pytest`, `pytest-asyncio`.

## Build everything

```bash
python scripts/build.py --all
```

Or scoped:

```bash
python scripts/build.py --brand    # logos + social + favicons (15 PNGs)
python scripts/build.py --ads      # ad creatives (6 PNGs)
```

## Design tokens as real source of truth

`brand/tokens.css` declares every color, font, and surface. **Every template
imports it and uses `var(--*)`** — no hardcoded hex in CSS rules. This is
enforced by `tests/test_tokens_truth.py`.

```html
<link rel="stylesheet" href="../../tokens.css">
```

Then use `var(--bg)`, `var(--accent)`, `var(--text-muted)`, etc.

Canonical background is `#0a0a0a`. Legacy `#0d0d0d` is banned by test.

## Tests

```bash
pytest                        # everything
pytest -m integration         # requires pipeline already run
pytest -m visual              # golden-image regression
pytest -m "not integration and not visual"  # fast unit-only pass
```

Three layers:

1. **Structural** — files exist, correct dimensions, correct source references.
2. **Tokens-truth** — every template imports `tokens.css` and uses `var(--*)`; no legacy hex.
3. **Visual regression** — perceptual diff (Pillow `ImageChops`) of 3 representative renders against `tests/goldens/`. Catches layout/color breaks that dimension checks miss.

Update a golden intentionally:

```bash
cp ads/renders/01-portfolio-grid.png tests/goldens/ad-portfolio-grid.png
```

## Determinism

Playwright renders wait for `document.fonts.ready` (not fixed timeouts).
Google Fonts load over the network on each render. For fully offline
builds, vendor the fonts locally and reference them in each template —
the pipeline itself already blocks on `document.fonts.ready`.
