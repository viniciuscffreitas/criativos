# UI chrome cleanup + Brand library edit/delete + Favicon

**Date:** 2026-04-29 (later session)
**Status:** Approved (user delegated 100% autonomy)
**Scope:** Five user-visible changes after first round of UI cleanup.

---

## What changes

| ID | Change | Type |
|---|---|---|
| S1 | Remove DesktopChrome wrapper — fill viewport | structural refactor |
| S2 | Hide scrollbars globally (kept scrollable, just invisible) | CSS-only |
| S3 | Favicon + app logo = `brand/logos/vibeweb-icon.svg` | static + 1 component |
| S4 | Palette swatches → click to edit, persisted as draft | feature |
| S5 | User uploads listed + selectable + deletable | feature + backend |

## S1 — Remove DesktopChrome

`DesktopChrome` rendered a fake macOS-window border with title-bar, padding,
shadow. The user clarified "deixa o web app real sem simular uma janela." App
should fill the viewport.

- Delete `<DesktopChrome>` wrapping in `App.tsx`
- The Sidebar + main view now mount directly inside `<body>` at `100vw × 100vh`
- TitleBar's "Criativos / {nav}" breadcrumb moves into the main view's header
  strip (Sidebar already names sections; FlowView/Gallery/BrandLibrary already
  have their own headers — the breadcrumb is redundant)
- Window controls (already removed previously) stay removed

## S2 — Hide scrollbars globally

> "nao quero que o scroll apareca nunca e sim seja 100% invisivel em todas as telas"

Scrollable content stays scrollable; the scrollbar visual is hidden.

- Global CSS in `index.html` (or a small `index.css`):
  - `* { scrollbar-width: none; }` (Firefox)
  - `*::-webkit-scrollbar { display: none; }` (Chromium/Safari)
- Test: rendered components still scroll on overflow; no visible scrollbar
  rendered (we can assert via `getComputedStyle` for `scrollbar-width: none`)

## S3 — Favicon + app logo = vibeweb-icon.svg

> "a logo do app quando aplicavel e o favicon deve ser o vibeweb-icon.svg"

- `<link rel="icon" href="/brand/logos/vibeweb-icon.svg" type="image/svg+xml">`
  in `features/web_gui/ui/index.html`
- App tab title stays "Criativos" (text)
- Anywhere we currently render an "app logo" (titlebar dot, etc — actually the
  DesktopChrome dot logo is going away in S1) → if a small mark is needed in
  Sidebar, use the SVG icon

## S4 — Palette edit

Each color swatch in the BrandLibrary palette becomes editable:
- Click swatch → `<input type="color">` overlay opens
- Choosing a color: live-applies the new value to the swatch + a CSS variable
  override scoped to the BrandLibrary preview (does NOT change brand/tokens.css)
- Persistence: localStorage key `cr_palette_draft` storing
  `{ accent: '#xxxxxx', bg: '#xxxxxx', ... }`
- "Resetar paleta" button when draft exists, clears localStorage, reverts to
  tokens.ts defaults
- Visual indicator "(rascunho)" near the section header when overrides exist
- **Out of scope:** persisting back to brand/tokens.css (that change ripples
  through all rendered creatives — separate spec).

## S5 — User uploads list + multi-select + delete

Existing state:
- `POST /api/v1/assets/upload` exists (uploads to `features/web_gui/uploads/`)
- No `GET` endpoint to list. No `DELETE` endpoint.
- BrandLibrary has no notion of user uploads.

New behavior:
- Backend: add to `features/web_gui/api/assets.py`:
  - `GET /api/v1/projects/{slug}/assets` → `{ assets: [{ file_id, filename, size, kind, created_at }] }`
  - `DELETE /api/v1/projects/{slug}/assets/{file_id}` → 204
- Frontend: BrandLibrary renders a new "Uploads" section ABOVE Logos:
  - Empty state: "Nenhum ativo enviado" + the existing upload button
  - With uploads: grid of cards, each with a checkbox in the corner
  - Selection toolbar appears when 1+ selected: "[2] selecionados · Excluir"
  - Confirm dialog: "Excluir 2 ativos? Não pode ser desfeito"
  - On confirm: parallel DELETE calls; success toast; refetch list
- Built-in brand assets (logos/social/favicons): no checkbox, no delete affordance.
  A small lock icon indicates they're part of the brand and not user-managed.

**Path resolution:** `uploads_dir()` in `features/web_gui/settings.py` already
returns the directory. The new GET reads its contents (skipping subdirs).

## Out of scope (deferred)

- Persisting palette edits back to `brand/tokens.css` (S4 ships as draft-only)
- Bulk download (only delete in this round)
- Drag-drop upload (existing button-based upload stays)
- Per-asset metadata editing (rename, tags, etc)
- Audit trail for deletions

## Risk + rollback

- S1 is the riskiest (touches App.tsx layout). E2E ui_e2e test should keep
  passing — if not, revert before push.
- S5 backend changes need pytest coverage — DELETE without confirmation
  protection on the server is fine (UI-side confirm), but we should reject
  paths that escape `uploads_dir()` (path traversal hardening).

## Verification

- `pytest -q` (Python) — full suite green, including new assets routes
- `npx vitest run` — full UI suite green
- `npx vite build` — no warnings
- E2E live smoke after deploy: brand library renders, upload + delete works,
  palette edit persists across reload, no scrollbars visible.
