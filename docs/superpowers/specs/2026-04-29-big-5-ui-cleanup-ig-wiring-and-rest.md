# Big-5: UI cleanup + IG wiring + 3 deferred specs

**Date:** 2026-04-29
**Status:** Approved (user delegated 100% autonomy)
**Scope:** 5 sub-projects. Execute in priority order. Each gets its own commits.

---

## Decomposition

The user asked for 5 things in one /spec. Each is independent and substantial.
This document records the decomposition + ordering. Implementation will land
across many commits per sub-project.

### E — UI cleanup + complete wiring **[PRIMARY]**
Why first: foundational. Until every tab/button works or is honestly removed,
the other specs are theatrical.

### A — IG content factory wired in web GUI
Backend route + Sidebar tab + IG-specific Gallery/Detail variants. Substantial.

### B — `instagram_content/` consumes `copy_generation` agent
After A. Remove hardcoded copy from IG templates; consume LLM-generated variants
from the existing PAS/AIDA/BAB methodologies.

### C — NPM resurrection / migration
Infrastructure issue affecting 25 unrelated sites (vibe-web.com, petshopcis…etc).
Out of band — not part of the criativos product. Spec'd separately when user
chooses strategy: revive NPM (port conflict with host nginx) or migrate all 25
hosts to host-level nginx + certbot.

### D — Reels (Spec D)
Short-video pipeline. New tooling required (Remotion or FFmpeg). Substantial.

---

## Execution policy

- **TDD per behavior change.** UI test (Vitest + jsdom) before edit.
- **Atomic commits** scoped to one E-item at a time.
- **Frontend gate skipped** for cleanup work (we are removing UI, not designing
  new UI; the visual language is already locked by Spec 3). For new UI in A
  (IG tab) the frontend-design skill is invoked before authoring.
- **Verify gate:** `pytest -q` + `cd ui && npx vitest run` after each item.
- **No regression** is the primary contract — if any test breaks, rollback or fix.

---

## E — UI cleanup tasks (audited)

| # | Item | File | Action |
|---|---|---|---|
| E1 | Hardcoded "Mateus R. · Plano Pro · 124 créditos" footer | `ui/src/components/Sidebar.tsx:99-115` | Remove block (no auth/billing system exists) |
| E2 | Fake window controls (min/max/close) doing nothing | `ui/src/components/DesktopChrome.tsx:54-72` | Remove (it's a web app, not Electron) |
| E3 | TweaksPanel placeholder toggles ("Spec 2 placeholders" per its own comment) | `ui/src/components/TweaksPanel.tsx:11-19` | Remove the placeholder lists; replace with a single working "Reduzir animações" toggle wired to `prefers-reduced-motion` (or fully delete the panel + ⌘; binding if user prefers) |
| E4 | CommandPalette unwired commands | `ui/src/components/CommandPalette.tsx:39-41` | Remove `ab-test`, `export-meta`, `settings` (all currently `wired: false`) |
| E5 | `adId="01"` hardcoded; no way to choose between 6 ads | `ui/src/App.tsx:74` | Add ad picker (select 01-06) above FlowView |
| E6 | Verify | full pytest + vitest + manual click-through | gate |

---

## A — IG wiring breakdown (high level — detailed plan written when E ships)

**Backend**
- `GET /api/v1/projects/{slug}/instagram` — list 48 IG renders grouped by category (avatar | highlight-cover | starter-story | grid-single | grid-carousel)
- `POST /api/v1/instagram/build` — trigger `python scripts/build.py --instagram` async, return run_id, stream progress
- `GET /api/v1/instagram/runs/{run_id}` — read status of a build run

**Frontend**
- New Sidebar nav: `instagram` (4th section, ⌘4)
- New view: `InstagramView` component with:
  - 9-slot grid preview (top-3 rows of feed-grid posts)
  - Highlight covers row
  - Starter stories carousel
  - "Build all" button → triggers POST /instagram/build with progress
- DetailPanel extends to show IG-specific metadata (slot, slide_index)

---

## C / D — deferred

C will be a separate spec when the user picks strategy (revive NPM vs migrate
hosts). It's not blocking criativos.

D needs a tooling decision (Remotion vs FFmpeg vs After Effects API). Out of
budget for this session.

---

## Out of session (will surface as tech-debt drafts at end)

- B: depends on A; doable in a follow-up session.
- C: needs user decision on strategy.
- D: needs tooling decision.
- Account-level: handle (`@vibeweb.eu` placeholder), bio link target
  (`vibeweb.eu/start` doesn't exist yet — Spec E from earlier roadmap).

---

## Rollback plan

Each commit is atomic and revertable. The merge backup branch
`backup/local-instagram-pre-merge` is preserved. If anything breaks
catastrophically, reset to the last green tag.
