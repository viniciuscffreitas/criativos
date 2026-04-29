#!/usr/bin/env bash
# Vibe Web — VPS install / update script (idempotent)
#
# Usage (on the VPS, as user vinicius):
#   bash deploy/install.sh
#
# Reads .env from the repo root (must already exist with
# CLAUDE_CODE_OAUTH_TOKEN set). The .env.example shows the schema.
#
# Idempotent: re-run after every git pull to apply updates.
#
# What it does:
#   1. Confirm prerequisites (docker, docker compose, git, caddy).
#   2. Pull latest code (if cwd is a git checkout).
#   3. Build + restart the container via docker compose.
#   4. Health-check the new container at 127.0.0.1:8090.
#   5. Reload Caddy if Caddyfile changed.
#
# Fails loud per CLAUDE.md §2.7 — any step error aborts.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log() { printf '\033[0;32m[deploy]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[deploy]\033[0m %s\n' "$*" >&2; }

# 1. Prereqs ----------------------------------------------------------
log "checking prerequisites"
for bin in docker git curl; do
    command -v "$bin" >/dev/null 2>&1 || { err "missing: $bin"; exit 1; }
done
docker compose version >/dev/null 2>&1 || { err "missing: docker compose plugin"; exit 1; }

if ! command -v caddy >/dev/null 2>&1; then
    log "caddy not present — proceeding (Caddyfile will be installed if you have caddy in /etc/caddy/)"
fi

# 2. .env ------------------------------------------------------------
if [ ! -f .env ]; then
    err ".env not found at $ROOT/.env — copy .env.example and fill CLAUDE_CODE_OAUTH_TOKEN"
    err "  cp .env.example .env && nano .env"
    exit 1
fi
log "using .env from $ROOT/.env"

# Quick sanity: warn if OAuth token looks empty
if ! grep -qE '^CLAUDE_CODE_OAUTH_TOKEN=.{20,}$' .env; then
    err "WARNING: CLAUDE_CODE_OAUTH_TOKEN looks empty or short in .env"
    err "  Real-mode generation will fail with auth errors."
    err "  Continuing with VIBEWEB_DRY_RUN=1 fallback if set in .env"
fi

# 3. git pull (only if checkout) -------------------------------------
if [ -d .git ]; then
    log "git pull origin main"
    git fetch origin main --quiet
    if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
        git pull --ff-only origin main
        log "code updated to $(git rev-parse --short HEAD)"
    else
        log "already at $(git rev-parse --short HEAD)"
    fi
fi

# 4. docker build + up -----------------------------------------------
log "building image"
docker compose build --pull

log "starting container"
docker compose up -d --remove-orphans

# 5. health -----------------------------------------------------------
log "waiting for healthcheck on 127.0.0.1:8090/docs (max 60s)"
attempts=0
until curl -fsS -o /dev/null -m 3 http://127.0.0.1:8090/docs; do
    attempts=$((attempts + 1))
    if [ $attempts -ge 30 ]; then
        err "container did not become healthy in 60s"
        err "  docker logs criativos --tail 50:"
        docker logs criativos --tail 50 2>&1 || true
        exit 1
    fi
    sleep 2
done
log "container healthy ✓"

# 6. caddy reload (if Caddyfile installed) ---------------------------
if [ -f /etc/caddy/Caddyfile ] && grep -q "criativos.vinicius.xyz" /etc/caddy/Caddyfile 2>/dev/null; then
    log "reloading caddy"
    sudo systemctl reload caddy || { err "caddy reload failed — check journalctl -u caddy"; exit 1; }
    log "caddy reloaded ✓"
else
    log "caddy config not installed yet — to wire the public hostname run:"
    log "  sudo cp deploy/Caddyfile /etc/caddy/Caddyfile.criativos"
    log "  echo 'import Caddyfile.criativos' | sudo tee -a /etc/caddy/Caddyfile"
    log "  sudo systemctl reload caddy"
fi

log "done — accessible at:"
log "  - locally:  http://127.0.0.1:8090/ui/"
log "  - public:   https://criativos.vinicius.xyz/ui/  (if Caddy + DNS configured)"
