# Vibe Web

Brand identity, marketing materials, and ad creatives for Vibe Web.

## Structure

```
vibeweb/
├── brand/              Brand identity system
│   ├── tokens.css      Design tokens (single source of truth — import from any HTML)
│   ├── guidelines.html Brand guidelines page (open in browser)
│   ├── guidelines.css  Guidelines page styling
│   ├── logos/          Logo variants (SVG sources + PNG renders)
│   ├── favicons/       Favicons (generated from logo icon)
│   └── social/
│       ├── templates/  HTML templates (Instagram post/story/highlight, LinkedIn, OG)
│       └── renders/    Generated PNG outputs
│
├── ads/                Meta Ads creatives (1080×1080)
│   ├── tokens.css      → imports ../brand/tokens.css
│   ├── templates/      6 HTML ad templates
│   ├── assets/         Device mockups (iPhone, MacBook) + site screenshots
│   ├── renders/        Generated PNGs (upload these to Meta Ads Manager)
│   ├── copy.md         Primary text / headline / description for each ad
│   ├── render.py       Playwright render pipeline
│   └── test_render.py  Structural tests (templates ↔ renders, dimensions)
│
├── scripts/
│   └── generate.py     Brand asset generator (logos, social, favicons)
│
└── tests/
    ├── conftest.py     Adds scripts/ to sys.path for imports
    └── test_generate.py
```

## Design tokens

`brand/tokens.css` is the single source of truth for colors, fonts, and surfaces.
Any new template should import it:

```html
<link rel="stylesheet" href="../../brand/tokens.css">
```

Then use `var(--accent)`, `var(--bg)`, `var(--text-muted)`, etc.

Canonical background is `#0a0a0a` (not `#0d0d0d` — legacy brand guidelines will be migrated).

## Render ad creatives

```bash
cd ads
python render.py
```

Reads `ads/templates/*.html`, writes `ads/renders/*.png`.

## Generate brand assets

```bash
python scripts/generate.py
```

Writes logos, favicons, and all social-media renders into `brand/`.

## Tests

```bash
pytest
```

72 tests across brand generation and ad pipeline. No Playwright required for structural tests.

## Requirements

```bash
pip install playwright pillow pytest
playwright install chromium
```
