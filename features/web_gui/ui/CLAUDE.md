# features/web_gui/ui — agent context

Inherits from `features/web_gui/CLAUDE.md`. SPA-specific rules.

## What this does

Vite 5 + React 18 + TypeScript 5.6 single-page app. Entry: `src/main.tsx`.
Talks to the FastAPI backend at `/api/v1` (see `src/api.ts`) and consumes
SSE from `/api/v1/generate/stream` via `streamGenerate()`.

## Inputs / outputs

- Input: REST + SSE from the FastAPI server. Types mirror backend shapes in
  `src/types.ts`.
- Output: `npm run build` writes to `../static/` (served by FastAPI at `/ui`).

## Non-obvious constraints

- **`src/tokens.ts` mirrors `brand/tokens.css`.** `tests/test_tokens_ui_parity.py`
  enforces parity — edit both or neither.
- **Dry-run parity lives in the backend.** No `if (dryRun)` branch in React.
  The SSE stream has identical event shapes in both modes.
- **SSE parser accepts a `fetchImpl` injection.** Tests pass a stub Response
  instead of mocking global fetch. Preserve this boundary.
- **`streamGenerate` emits a typed `error` event** for both malformed JSON
  (`SSE_PARSE_ERROR`) and missing response body (`NO_BODY`) — no silent
  fallbacks in the SSE loop (§2.7).
- **`tsconfig.app.json` has `noUnusedLocals: true` and `noUnusedParameters: true`.**
  Build fails on dead code by design.
