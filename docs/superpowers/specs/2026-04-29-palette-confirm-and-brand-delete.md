# Palette confirmation modal + Brand asset deletion + Typography edit

**Date:** 2026-04-29 (third iteration of the day)
**Status:** Approved (user delegated 100% autonomy)
**Scope:** Three connected user-facing improvements to the Marca tab.

---

## Changes

| ID | What | Why |
|---|---|---|
| T1 | Confirmation modal component | shared building block for T2+T3 |
| T2 | Palette swatch click → confirm modal (preview before apply) | "Eh possível mudar sem querer" |
| T3 | Typography click → confirm modal (font family edit, draft like palette) | "tipografia tambem nao ta dando pra trocar" |
| T4 | Backend: `DELETE /api/v1/brand-files` for canonical brand assets | Allow logos/social/favicons deletion |
| T5 | Selection + delete UX extends to canonical assets | "nao ta dando pra deletar nada que tem em favicons, social, logos" |

---

## T1 — Confirmation modal component

`<ConfirmDialog>` — reusable, used by T2 + T3 + (already) the uploads bulk delete.

Props:
- `open`
- `title`
- `body` (ReactNode — caller renders preview)
- `confirmLabel` (default "Confirmar")
- `confirmVariant` (default "primary"; "danger" for deletes)
- `onConfirm`, `onClose`

Behavior:
- Backdrop dim; ESC closes; Enter confirms
- Focus trap inside the dialog
- Returns null when `open=false`

## T2 — Palette swatch confirm

Current: clicking a swatch opens native `<input type="color">`, edits live-apply.

New flow:
- Click swatch → modal opens with:
  - Side-by-side preview: "atual" vs "nova" (new color is initially equal to current)
  - Color picker `<input type="color">` for the new value
  - Hex text input mirroring the picker
  - "Confirmar" applies + persists draft / "Cancelar" discards
- `Esc` cancels; `Enter` confirms; backdrop click cancels

The localStorage draft model (`cr_palette_draft`) stays — only the entry-point changes.

## T3 — Typography edit

Currently `<BrandLibrary>` shows 3 fonts read-only (Syne / DM Sans / Fira Code).

New: each font card is click-to-edit.
- Click → confirm modal with:
  - Live preview of "Aa" rendered in the typed family
  - Text input for the font-family stack (free text — paste a Google Fonts CSS family if needed)
  - 5-6 quick suggestions as chips below the input (Syne, DM Sans, Fira Code, Inter, Geist, Roboto)
- Persistence: localStorage `cr_typography_draft` keyed by role
- "Resetar tipografia" button when a draft exists, mirrors palette's reset
- Out of scope: writing back to brand/tokens.css.

## T4 — Backend: DELETE /api/v1/brand-files

Allows the UI to remove canonical brand files from disk.

`DELETE /api/v1/brand-files`
- Body: `{"path": "logos/vibeweb-primary.svg"}` — relative under `brand/`
- 204 on success
- 400 INVALID_PATH if `..` segments OR absolute path OR escapes brand/ via symlink
- 403 PROTECTED_PATH for explicitly-protected names: `tokens.css`, `guidelines.html`, `guidelines.css`
- 404 NOT_FOUND if file doesn't exist

Path resolution:
- `safe = (brand_dir() / path).resolve()`
- Reject if `not safe.is_relative_to(brand_dir())`
- Reject if path contains `..` segments before resolution (defense in depth)
- Reject if filename matches PROTECTED set

Tests cover: success, 400 path-traversal, 403 protected, 404 missing.

## T5 — Selection + delete extends to canonical assets

Today only "Seus uploads" cards are selectable. New behavior:

- Each canonical asset card (Logos / Social / Favicons sections) gets a checkbox in the corner — same affordance as uploads.
- The selection set lives at the `<BrandLibrary>` level so it spans all sections.
- The bulk-delete toolbar (currently inside `<BrandUploadsSection>`) moves into `<BrandLibrary>` header strip — appears whenever ≥1 item is selected, regardless of section.
- On confirm, each selected item is dispatched to its appropriate endpoint:
  - User uploads → `DELETE /api/v1/projects/{slug}/assets/{file_id}`
  - Canonical brand → `DELETE /api/v1/brand-files` with `path` body
- Refetch lists after delete; clear selection on success.

Each asset gets a stable `selectionId` so the parent set is type-agnostic:
- Uploads: `upload:{file_id}`
- Canonical: `brand:{src-path}` (e.g. `brand:logos/vibeweb-primary.svg`)

The brand asset list (currently `BRAND_ASSETS` const) shrinks dynamically — after a delete, the parent re-evaluates which canonical files actually exist on disk via a new endpoint or the existing /brand StaticFiles 404 behavior. For MVP: the parent maintains a per-session "deleted" set in state so just-deleted items disappear immediately. Truly authoritative listing would need a `GET /api/v1/brand-files` (deferred — current work is reactive).

---

## Risk + rollback

- T4 is the highest-risk because it deletes git-tracked files. Two mitigations:
  - **Container** filesystem changes don't survive container rebuild (Dockerfile COPYs brand/) → state is "ephemeral" on the VPS by design. A delete via UI on the VPS removes the file from the container; the next deploy restores it. This is the correct UX: deletes are container-scoped, not git-scoped.
  - **Local dev** runs against the actual repo → a delete via UI does modify the working tree. Document this in the Marca tab via a small note.
- All deletes go through the same `window.confirm` flow as uploads (extended with batch count).
- TDD per task; full pytest + vitest after each commit.

## Verification

- `pytest -q` — 621+ tests including new brand-files routes
- `npx vitest run` — 96+ tests including new ConfirmDialog + palette confirm + typography edit
- `npx vite build` — clean
- E2E live: open Marca, edit accent → confirm dialog appears → confirm → swatch updates and persists; select a logo → click Excluir → confirm → logo disappears (refresh shows it still gone if container hasn't been rebuilt)
