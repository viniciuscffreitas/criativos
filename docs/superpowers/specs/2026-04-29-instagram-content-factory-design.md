# Instagram Content Factory v1 — Design Spec

**Date:** 2026-04-29
**Status:** Approved (user delegated 100% autonomy after Section 1 sign-off)
**Scope:** Bootstrap a conversion-focused English Instagram account for Vibe Web (web agency, Europe) where the IG profile functions as the **landing destination** of Meta Ads campaigns. Delivers strategy + visual identity + a launch batch of 9 grid posts (6 singles + 3 carousels = 27 PNG renders) using the existing deterministic Playwright pipeline.

---

## 1. Context

The current pipeline (`scripts/build.py --all`) produces 21 deterministic PNGs for brand + 6 Meta ad creatives. Copy is hardcoded in HTML; tokens.css is the single source of truth for design.

**The new fact that changes the framing:** the user explicitly stated the Instagram account IS the target landing of the Meta Ads campaign. Visitors who click on the ad land on the profile, not on a website. So the IG profile must convert on first impression — like a one-page landing site, where the grid is "above the fold," highlights are FAQ/proof sections, and the bio is the headline + CTA.

This spec produces the v1 launch batch. Spec 1 (AI Creative Factory, 2026-04-17) is independent — when its LLM copy generation lands, this feature becomes a consumer of it. We do not block on Spec 1.

---

## 2. Goals and non-goals

### Goals
- Reusable Instagram content factory in `features/instagram_content/` (vertical slice per CLAUDE.md §2.1).
- Launch batch: 9 grid posts (6 singles + 3 carousels, 7 slides each = 27 renders) ready to publish.
- All copy in English, PAS methodology (Problem-Agitate-Solution) — consistent with the 6 existing ads.
- Bio text drafted and committed.
- Use existing 5 highlight covers (already rendered) without redesign.
- Reuse `scripts.pipeline` for deterministic font loading; no new rendering dependency.
- Tokens-as-truth: zero hex literals; new `--ig-handle` token for handle templating.
- Closed-loop verification (CLAUDE.md §2.5): structural + tokens-truth + visual regression + new safe-zone lint.
- CLI: `python scripts/build.py --instagram` and `--all` extended.

### Non-goals (explicitly deferred)
- **Reels** — short-video pipeline is a separate spec (D). Playwright cannot render video; Reels need Remotion / FFmpeg / After Effects.
- **Stories** beyond what's already rendered. Story templates land in a future spec.
- **Conversion funnel beyond bio** — DM script, discovery-call landing page (`vibeweb.eu/start`), CRM integration are separate spec (E).
- **Highlight cover redesign** — the 5 existing covers are reused as-is.
- **NPQEL methodology** — still undefined per Spec 1; not blocking. PAS only.
- **LLM copy generation** — copy is hardcoded in templates for v1, same as today's ads. When Spec 1 ships, this feature migrates to consume `copy_generation` agent.
- **Meta Marketing API** — manual posting via Meta Business Suite for v1.
- **Posting cadence automation** — only the launch batch is in scope. Cadence recommendations in Section 3 are advisory, not bakeable.

---

## 3. Strategy (locked at brainstorming, summarized here)

### Positioning
> Custom websites for European freelancers and small businesses. From €450, ready in 7 days.

### Audience
| Tier | Who | Pain |
|---|---|---|
| Primary | European freelancer designer/photographer/consultant (UK/IE/NL/Nordics/DACH) without a site, or with a generic Wix/Carrd | "I'm good but I look amateur" |
| Secondary | European small business (3-15 employees) with an outdated/slow site | "2010-era site kills credibility" |
| Tertiary | Solopreneur launching a product/service | "Need a fast site to start selling" |

### 5 Content pillars (each post maps to one)
| # | Pillar | PAS slot | v1 batch coverage |
|---|---|---|---|
| P1 | Pain mirror | Problem | 2 singles (manifesto, niche-tag) |
| P2 | Cost of inaction | Agitate | 1 single (cost) |
| P3 | Proof — number, name, before/after | Solution-evidence | 2 (proof-number single + portfolio carousel) |
| P4 | Offer mechanics — price, prazo, included | Solution-offer | 2 (offer-mechanics single + services carousel) |
| P5 | Process / method — credibility | Solution-credibility | 2 (cta-pure single + process carousel) |

### KPIs (funnel-shaped, not vanity)
| KPI | v1 target (month 1) | Source |
|---|---|---|
| Profile-visit-to-DM rate | ≥ 4% | Meta Business Suite |
| Profile-visit-to-bio-link click | ≥ 6% | UTM tracking |
| Carousel completion rate | ≥ 60% | Insights per post |
| Save rate (carousels) | ≥ 2% | Insights |
| DM-to-discovery-call rate | ≥ 25% | Manual CRM/sheet |

Non-KPIs: likes, follower count. The 2026 algorithm ranks on dwell time + swipe velocity, not likes.

### Cadence (advisory, post-launch — not implemented)
- Static post: 2x/week (Tue, Fri)
- Carousel: 1x/week (Wed)
- Story: 3-5x/week (template = future spec)
- Reel: 1x/week (= future spec D)

---

## 4. 2026 Instagram fact pack (informs technical decisions)

| Decision | Source |
|---|---|
| **Posts: 1080×1350 (4:5 portrait)**, not 1080×1080. 23% more likes than square in 2026. | [Buffer 2026 guide](https://buffer.com/resources/instagram-image-size/), [Inro.social](https://www.inro.social/blog/instagram-post-size) |
| **Grid preview: 3:4 crop** — 4:5 posts get cropped top/bottom in profile grid. Implies 60px safe-zone top + bottom. | [Buffer 2026 guide](https://buffer.com/resources/instagram-image-size/) |
| **Carousels: 7-10 slides** is the algorithm sweet spot. Slide 1 = 80% of weight. < 0.25s hook. < 10 words. | [TrueFuture Media](https://www.truefuturemedia.com/articles/instagram-carousel-strategy-2026), [TryMyPost](https://www.trymypost.com/blog/instagram-carousel-algorithm-2026-guide) |
| **Algorithm 2026 ranks by dwell time + swipe-through velocity**, not likes. | [Marketing Agent Blog](https://marketingagent.blog/2026/01/03/mastering-instagram-carousel-strategy-in-2026-the-algorithm-demands-swipes-not-just-scrolls/) |
| **Carousel engagement: 10% vs 7% single vs 6% Reel.** Mixed-media carousels (img+video) outperform image-only 2.33% vs 1.80%. | TrueFuture Media |
| **Open-loop technique:** pose question on slide 1, answer on slide 5-6. | TrueFuture Media |

**Implications baked into design:**
- All v1 grid posts render at **1080×1350** (single + carousel slides). The legacy `brand/social/templates/instagram-post.html` (1080×1080) is left untouched but considered superseded for IG content.
- All 3 carousels = **7 slides each** (sweet spot floor). Total carousel slides: 21.
- Each carousel has a deliberate open-loop somewhere between slide 1 and slide 5.
- Safe-zone: nothing critical (text, CTA) within 60px of top/bottom.

---

## 5. Architecture — vertical slice

```
features/
  instagram_content/              # NEW — vertical slice per CLAUDE.md §2.1
    __init__.py
    CLAUDE.md                     # feature-specific context
    bio.md                        # bio text (copy-paste into IG; not rendered)
    render.py                     # entry-point — async main, calls scripts.pipeline
    jobs.py                       # declarative list of 27 RenderJobs
    templates/
      single-manifesto.html
      single-cost-of-inaction.html
      single-proof-number.html
      single-niche-tag.html
      single-offer-mechanics.html
      single-cta-pure.html
      carousel-portfolio.html     # ?slide=1..7  (intro + 6 sites + CTA)
      carousel-services.html      # ?slide=1..7  (open-loop on slide 5)
      carousel-process.html       # ?slide=1..7  (Day 1 → Day 7 + CTA)
    test_render.py                # structural + visual regression
    goldens/
      *.png                       # 27 golden PNGs, populated on first authored run
```

**Modifications to existing files:**
- `brand/tokens.css` — add `--ig-handle: "@vibeweb.eu";` (string token; consumed via `content: var(--ig-handle)` in CSS).
- `scripts/build.py` — add `--instagram` flag; route to `features.instagram_content.render.main`.
- `tests/test_tokens_truth.py` — extend the glob list to include `features/instagram_content/templates/*.html`.

**Why parameterize carousels (Approach 2 from brainstorming):**
- Portfolio carousel: 6 of 7 slides share layout (only screenshot + site name change). Parameterizing via `?slide=N` collapses 6 near-duplicates into 1 template + 1 conditional. Matches the existing `instagram-highlight.html?type=...` pattern.
- Services + Process carousels are similarly structured — each slide is a "card" with title + body + visual emphasis variant. Parameterization fits.
- Single posts are NOT parameterized: each carries a structurally distinct concept (manifesto vs. niche-tag vs. price vs. CTA-pure). DAMP-where-unstable applies — they share no invariant beyond brand tokens.

---

## 6. Concrete content — the 27 renders

### Grid order (top-left newest → bottom-right oldest, 3×3)

| Slot | Type | Pillar | Slide-1 hook |
|---|---|---|---|
| 1 | single-manifesto | P1 | "Most freelancers send a Notion link. You're not most freelancers." |
| 2 | single-cost-of-inaction | P2 | "Every week without a site, 3 clients pick someone else." |
| 3 | single-niche-tag | P1 | "Designers who can't afford a generic agency." |
| 4 | carousel-process | P5 | "How I deliver in 7 days. (No, it's not a template.)" |
| 5 | single-proof-number | P3 | "6 sites. 7 days each. €450 minimum." |
| 6 | carousel-services | P4 | "What you get for €450" |
| 7 | single-offer-mechanics | P4 | "€450. 7 days. Done." |
| 8 | carousel-portfolio | P3 | "6 sites I built in 60 days. Pick a favorite. →" |
| 9 | single-cta-pure | CTA | "Send 'site'. Get a Loom in 24h." |

### Carousel — Portfolio (`carousel-portfolio.html?slide=1..7`)

Reuses screenshots from `ads/assets/`: `site-onearc.png`, `site-alytics.png`, `site-lunera.png`, `site-messageai.png`, `site-dreelio.png`, `guima-dark.png`.

| Slide | Content |
|---|---|
| 1 | "6 sites I built in 60 days. Pick a favorite. →" (hook + arrow CTA) |
| 2 | onearc screenshot + "Onearc — SaaS landing in 6 days" |
| 3 | alytics screenshot + "Alytics — analytics dashboard, 7 days" |
| 4 | lunera screenshot + "Lunera — wellness brand, 5 days" |
| 5 | messageai screenshot + "MessageAI — product launch site, 7 days" |
| 6 | dreelio screenshot + "Dreelio — creator portfolio, 4 days" |
| 7 | "Yours next? DM 'site' to start." (CTA) |

### Carousel — Services (`carousel-services.html?slide=1..7`)

Open-loop: slide 1 says "what you get"; slide 5 reveals "what you don't get" — keeps swipe momentum.

| Slide | Content |
|---|---|
| 1 | "What you get for €450" (open-loop hook) |
| 2 | "5 pages. Custom design. Mobile-first." |
| 3 | "Copy that converts. Not template fluff." |
| 4 | "SEO basics built in. Analytics. Forms." |
| 5 | "What you don't get." (open-loop reveal) |
| 6 | "Templates. Generic stock photos. 6-week timelines." |
| 7 | "Ready in 7 days. DM 'site' →" |

### Carousel — Process (`carousel-process.html?slide=1..7`)

| Slide | Content |
|---|---|
| 1 | "How I deliver in 7 days. (No, it's not a template.)" |
| 2 | "Day 1 — Brief. 30-min call. I take notes; you don't." |
| 3 | "Day 2-3 — Design. Figma in 48h. One round of changes free." |
| 4 | "Day 4-5 — Build. Real code. No-code = no thanks." |
| 5 | "Day 6 — Polish + SEO + speed." |
| 6 | "Day 7 — Launch. You get the keys." |
| 7 | "DM 'site' if this sounds like your week." |

### Singles — copy

| Template | Headline | Sub | CTA |
|---|---|---|---|
| single-manifesto | "Most freelancers send a Notion link." | "You're not most freelancers." | "DM 'site' to start →" |
| single-cost-of-inaction | "Every week without a site," | "3 clients pick someone else." | "How long can you afford that?" |
| single-niche-tag | "Designers who can't afford a generic agency." | "Custom sites that look like your work, not their template." | "DM 'site' →" |
| single-proof-number | "6 sites. 7 days each." | "€450 minimum. Last month, every client said yes to round one." | "Yours next? →" |
| single-offer-mechanics | "€450. 7 days. Done." | "5 pages · Custom design · Real code · Live in a week." | "What's included →" |
| single-cta-pure | "Send 'site'." | "Get a Loom in 24h showing how I'd build yours." | "@vibeweb.eu" |

### Bio (`bio.md`)

```
Custom websites · €450 · 7 days
For European freelancers + small businesses
DM 'site' to start →
@vibeweb.eu  ↓
```

**Link in bio:** `vibeweb.eu/start` (placeholder URL — landing page is Spec E).

**Highlights pin order on profile:** services → portfolio → about → contact → feed.

---

## 7. Data model

There is no YAML config in v1. Copy is hardcoded in HTML templates per CLAUDE.md §2.2 ("verbose entry-points, no jump-tax"). When Spec 1 (AI Creative Factory) ships, this feature migrates to consume `config/instagram.yaml` + Jinja2 — but that's deferred.

The only structured data is `jobs.py`:

```python
# features/instagram_content/jobs.py
from pathlib import Path
from scripts.pipeline import RenderJob

TEMPLATES = Path(__file__).parent / "templates"
RENDERS = Path(__file__).parent / "renders"
W, H = 1080, 1350  # 4:5 portrait — 2026 IG default

SINGLES = [
    "single-manifesto",
    "single-cost-of-inaction",
    "single-niche-tag",
    "single-proof-number",
    "single-offer-mechanics",
    "single-cta-pure",
]

CAROUSELS = {
    "carousel-portfolio": 7,
    "carousel-services":  7,
    "carousel-process":   7,
}

def build_jobs() -> list[RenderJob]:
    jobs: list[RenderJob] = []
    for stem in SINGLES:
        jobs.append(RenderJob(
            source=TEMPLATES / f"{stem}.html",
            out=RENDERS / f"{stem}.png",
            width=W, height=H,
        ))
    for stem, n in CAROUSELS.items():
        for i in range(1, n + 1):
            jobs.append(RenderJob(
                source=TEMPLATES / f"{stem}.html",
                out=RENDERS / f"{stem}-slide-{i}.png",
                width=W, height=H,
                query=f"?slide={i}",
            ))
    return jobs
```

Total: 6 + 21 = 27 jobs.

---

## 8. Tokens

Adds one token to `brand/tokens.css`:

```css
:root {
  /* ... existing tokens ... */
  --ig-handle: "@vibeweb.eu";   /* swap when handle confirmed */
}
```

Consumption pattern in templates:
```css
.handle::before { content: var(--ig-handle); }
```

This is a content-string token (not a color), but tokens.css is the single source of truth — placing it elsewhere violates the architectural principle. The tokens-truth test (`tests/test_tokens_truth.py`) only enforces "no hex literals," not "no string content," so this addition does not require test changes beyond the glob extension.

---

## 9. Testing strategy

Four layers (extends CLAUDE.md §2.5):

### 9.1 Structural (`test_render.py::test_jobs_produce_correct_dimensions`)
For each `RenderJob` in `jobs.build_jobs()`, verify:
- Rendered PNG exists at `job.out`.
- File size > 0.
- Dimensions match `(job.width, job.height)` exactly via Pillow.

### 9.2 Tokens-truth (extends `tests/test_tokens_truth.py`)
Extend the existing glob to include `features/instagram_content/templates/*.html`. The current rule "no hex literals + no brand rgba literals outside tokens.css" applies unchanged.

### 9.3 Visual regression (`test_render.py::test_visual_regression`)
For each render, compare to `goldens/<name>.png` via Pillow `ImageChops.difference`. Threshold: max pixel diff ≤ 5 (matches `tests/test_visual_regression.py` precedent).

Goldens populated on first authored run (developer commits the initial goldens after manual visual inspection).

### 9.4 Safe-zone lint (`test_render.py::test_safe_zone`) — **new**
Static analysis on each template HTML+CSS. For every element matching `h1, .headline, .cta, .cta-bar, .hook, .main-text` (the "critical text" set):
- Reject if the element's `top` is set to a value `< 60px`.
- Reject if `bottom` is set to `< 60px`.
- Reject if the element is inside a parent that places it in the top 60px or bottom 60px of a 1080×1350 viewport (heuristic: parent `top` + element `top` < 60).

Implementation: BeautifulSoup or simple regex parser (single-pass per template). The test fails fast with the offending selector + computed offset.

This catches cases where the post would render fine in feed (4:5 full) but get critical text cropped in the 3:4 grid preview — the reason listed in §4.

---

## 10. Error handling (per CLAUDE.md §2.7)

- Missing template file → `FileNotFoundError` with full path; no fallback.
- Missing screenshot in `ads/assets/` referenced by carousel-portfolio → `FileNotFoundError` with the slide number and asset name in the message; no silent gray block.
- Pillow dimension mismatch → fail the structural test loudly with both dimensions in the assertion.
- Safe-zone violation → fail the lint test with the exact selector and offset.

No `try/except` that swallows and returns `None`. No "fallback to default font" magic — `document.fonts.ready` is the contract.

---

## 11. CLI integration

Extend `scripts/build.py`:

```python
g.add_argument("--instagram", action="store_true", help="Render Instagram content batch (9 grid posts + 21 carousel slides)")
# ... existing --brand, --ads, --all
```

`--all` runs brand + ads + instagram. Order: brand first (logos used), ads, then instagram (reuses ad screenshots from `ads/assets/`).

`render.py` is a thin async main:
```python
from scripts.pipeline import run_jobs
from features.instagram_content.jobs import build_jobs

async def main():
    jobs = build_jobs()
    print(f"Rendering {len(jobs)} Instagram assets...")
    await run_jobs(jobs)
```

---

## 12. Migration / publish path (out of scope but documented)

For v1 launch, the user manually:
1. Runs `python scripts/build.py --instagram` → produces 27 PNGs in `features/instagram_content/renders/`.
2. Reviews goldens; commits them on first run.
3. Uploads via Meta Business Suite Composer in this exact order (so grid newest-top-left lands correctly):
   - Post 9 → Post 8 → ... → Post 1 (reverse chronological).
4. For carousels, uploads slides 1-7 in order in a single carousel.
5. Pastes `bio.md` content into IG bio.
6. Pins highlights in the order: services → portfolio → about → contact → feed.

Steps 3-6 are documented in `features/instagram_content/CLAUDE.md` as the publish runbook. Automation via Meta Marketing API is Spec E (deferred).

---

## 13. Explicitly out-of-scope

- Reels / video content (Spec D).
- Story templates beyond what's already rendered (future spec).
- Conversion funnel: DM auto-reply, discovery-call landing, CRM integration (Spec E).
- Highlight cover redesign (existing 5 are reused).
- LLM copy generation for IG (will consume Spec 1 when it ships; v1 is hardcoded).
- Multi-language (English only).
- Posting cadence automation.
- Meta Marketing API integration.
- A/B variation orchestration for IG (Spec 2 territory).
- Multi-tenant (mono-tenant — Vibe Web only).

---

## 14. Open risks (acknowledged, not blocking)

| Risk | Mitigation |
|---|---|
| Handle `@vibeweb.eu` may not be available on Instagram | Codified as `--ig-handle` token; swap is one-line |
| 27 goldens require manual visual review on first run before commit | Initial review is one-time; subsequent diffs are automated |
| Bio character count limit (150 chars) is tight | Bio drafted at ~110 chars; if user adds suffix during paste, residual budget is 40 chars |
| Grid order in Meta Business Suite is finicky (uploads land top-left newest, not by slot index) | Documented in publish runbook (§12) |
| 4:5 portrait crop in 3:4 grid view may still surprise on edge templates | Safe-zone lint catches this at test time, not at upload time |
