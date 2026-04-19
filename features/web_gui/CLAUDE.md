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
- **AIDA/BAB/NPQEL return 501.** UI toggles exist but disabled with tooltip.
