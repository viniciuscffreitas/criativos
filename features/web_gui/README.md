# features/web_gui

Local desktop app for Vibe Web's AI Creative Factory. FastAPI backend + Vite + React SPA.

Entry-points:
- `server.py` — FastAPI app, all routes registered explicitly (§2.2 no jump-tax)
- `ui/src/main.tsx` → `ui/src/App.tsx` — React root
- `ui/src/api.ts` — typed client for the REST + SSE surface

## Run it

### Dev (live-reload both sides)

```bash
python scripts/dev.py
# → backend on :8000 (--reload), vite ui on :5173 with /api proxy
# → open http://localhost:5173/ui/
```

`scripts/dev.py` defaults to `VIBEWEB_DRY_RUN=1` so the dev loop never hits
the Anthropic API by accident. Set `VIBEWEB_DRY_RUN=0` to go live.

### Prod-local (one server, built bundle)

```bash
cd features/web_gui/ui && npm run build && cd -
/opt/homebrew/bin/python3.14 -m uvicorn features.web_gui.server:app --port 8000
# → open http://localhost:8000/ui/
```

FastAPI serves the Vite build from `features/web_gui/static/` at `/ui/`.
The `base: '/ui/'` in `ui/vite.config.ts` keeps asset paths consistent
between dev, preview, and prod-local.

## Test

```bash
# Backend contract tests (FastAPI TestClient, no browser)
/opt/homebrew/bin/pytest features/web_gui/ -q

# UI component tests (Vitest + jsdom)
cd features/web_gui/ui && npx vitest run

# E2E (opt-in — boots uvicorn on :8765, runs Playwright chromium)
VIBEWEB_E2E=1 /opt/homebrew/bin/pytest features/web_gui/test_ui_e2e.py -m e2e -v
```

The e2e fixture snapshots/restores `config/ads.yaml` around the session
so the flow's brief-write does not pollute git state.

## Ports

| Port | Owner                          |
|------|--------------------------------|
| 8000 | uvicorn (dev + prod-local)     |
| 5173 | vite dev server + proxy        |
| 8765 | e2e-only uvicorn (conftest.py) |

## Structure

```
features/web_gui/
  server.py              FastAPI app — all routes registered here
  routes/                per-resource route modules
  services/              yaml_rw (flock), project/brief/creative stores
  conftest.py            ui_server fixture for e2e
  test_server.py         contract tests (TestClient)
  test_ui_e2e.py         Playwright flows + visual regression
  traces/                .gitignored — run-id → reasoning JSON
  static/                .gitignored — vite build output
  ui/
    src/
      api.ts             REST + SSE client (typed)
      types.ts           mirrors backend shapes
      tokens.ts          mirrors brand/tokens.css
      components/        feature subtrees (flow/, etc.)
      setup-tests.ts     vitest setup (jest-dom + MemoryStorage shim)
    vite.config.ts       base='/ui/' + /api proxy
```

See `CLAUDE.md` for per-file responsibilities and agent context.
