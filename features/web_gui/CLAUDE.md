# features/web_gui — agent context

Inherits from the root `CLAUDE.md`. Feature-specific rules.

## What this does

FastAPI backend (Python) + Vite + React + TypeScript frontend (`ui/`) serving
as the local desktop app for generating Meta Ads creatives through Vibe Web's
AI agents. Plugs into `features/copy_generation/agent.generate()` over HTTP+SSE.

## Non-obvious constraints

- **Vertical slice = everything lives here.** `server.py` is the verbose entry-point;
  no hidden orchestrators. Routes registered explicitly in the file.
- **YAML is the source of truth.** No database. `config/projects.yaml` +
  `config/ads.yaml` carry state; writes are atomic with fcntl.flock via
  `services/yaml_rw.py`.
- **Dry-run parity is load-bearing.** UI code path is identical between dry-run
  and real; backend handles the fork. Never `if (dryRun)` in React.
- **Traces go to disk.** `features/web_gui/traces/<run_id>.json` — .gitignored.
- **kind: image only in MVP.** Schema supports video/carousel/copy; UI shows
  empty tabs with "em breve" for those kinds until Spec 2/3 extensions land.
- **NPQEL returns 501.** UI chip for NPQEL is absent (only PAS/AIDA/BAB are
  exposed); the backend whitelist (`IMPLEMENTED_METHODOLOGIES`) gates the stub.
  PAS, AIDA, BAB are live methodologies — see `features/copy_generation/`.
- **Ports are fixed.** `:8000` uvicorn (dev + prod-local), `:5173` vite dev,
  `:8765` e2e-only (`conftest.py`). Changing any of these requires updating
  the proxy in `ui/vite.config.ts` and the fixture in `conftest.py`.
- **Vite `base: '/ui/'`.** FastAPI serves the built bundle at `/ui/`, so the
  base lives in `vite.config.ts` (not the CLI) so build / preview / dev all
  agree on asset paths. See `ui/vite.config.ts`.
- **E2E mutates state — the fixture restores it.** The full flow persists the
  brief via `PUT /briefs`, which rewrites `config/ads.yaml`. `ui_server`
  snapshots + restores that file so repeated e2e runs leave git clean.

## Testing

- Contract (FastAPI TestClient): `pytest features/web_gui/ -q`
- Component (Vitest + jsdom): `cd ui && npx vitest run`
- E2E (Playwright, opt-in): `VIBEWEB_E2E=1 pytest features/web_gui/test_ui_e2e.py -m e2e -v`
- Visual regression (Review screen): bundled in the e2e file, golden at
  `tests/goldens/web-gui-review-dryrun.png`, same fraction-diff tolerance
  as `tests/test_visual_regression.py`.

## Running locally

`scripts/dev.py` launches uvicorn (`--reload` on :8000) and vite (:5173) side
by side. Ctrl+C kills both; if either crashes the other is brought down too
(§2.7 no silent half-running state). Defaults `VIBEWEB_DRY_RUN=1`.
