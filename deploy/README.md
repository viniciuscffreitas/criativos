# Vibe Web — VPS Deploy

Production deploy on a Linux VPS (tested on Debian/Ubuntu) behind Caddy reverse proxy.

## One-time bootstrap

```bash
# On the VPS, as user vinicius (with sudo)
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git caddy curl
sudo usermod -aG docker vinicius
newgrp docker  # or logout/login

# Clone
cd /home/vinicius
git clone https://github.com/viniciuscffreitas/criativos.git
cd criativos

# Configure secrets
cp .env.example .env
nano .env
# Set CLAUDE_CODE_OAUTH_TOKEN (real-mode) or leave empty + VIBEWEB_DRY_RUN=1 for safe demo

# Wire Caddy (one time)
sudo mkdir -p /etc/caddy
# Append our config to the main Caddyfile
sudo tee -a /etc/caddy/Caddyfile < deploy/Caddyfile
sudo systemctl reload caddy

# DNS (out of scope here): point criativos.vinicius.xyz A record to this VPS IP
```

## Deploy / update

```bash
cd /home/vinicius/criativos
bash deploy/install.sh
```

The script is idempotent. Re-run after `git pull` to apply updates. It:
1. Pulls latest code
2. Rebuilds Docker image
3. Restarts container
4. Health-checks at 127.0.0.1:8090
5. Reloads Caddy if Caddyfile is installed

## Verify

```bash
# Local check on VPS
curl -s http://127.0.0.1:8090/api/v1/projects | jq

# Public check (after DNS + Caddy + cert provisioning)
curl -s https://criativos.vinicius.xyz/api/v1/projects | jq
```

Browser: `https://criativos.vinicius.xyz/ui/`

## Rollback

The container is named `criativos`. Previous image stays available unless explicitly pruned:

```bash
docker images criativos        # see tags
docker compose down            # stop current
docker tag criativos:<old-sha> criativos:latest  # tag old as latest
docker compose up -d           # restart on old image
```

## Logs

```bash
docker logs criativos --tail 100 -f       # app logs
sudo journalctl -u caddy -n 100 -f        # caddy logs
```

## Files

- `Caddyfile` — reverse proxy config (host: criativos.vinicius.xyz → 127.0.0.1:8090)
- `install.sh` — idempotent deploy script

## Architecture

```
internet → caddy (:443, terminates TLS, Let's Encrypt auto)
              ↓
        127.0.0.1:8090 (host loopback, container exposed only locally)
              ↓
        criativos container (uvicorn :8000 inside)
              ↓
        FastAPI app (features.web_gui.server:app)
              ↓
   ┌──────────┼─────────────┐
   ↓          ↓             ↓
  /api      /ui/         /renders/
  routes    static       (volume-mounted)
              ↓
       Vite-built React bundle
```

## Why this layout

- **Container exposes only loopback (127.0.0.1:8090)**: the only ingress is via Caddy, which handles TLS and request inspection. The app never sees raw external traffic.
- **Volumes for `config/`, `traces/`, `uploads/`**: persisted across rebuilds so re-deploying doesn't lose project YAML or run history.
- **`VIBEWEB_DRY_RUN=1` default**: safe demo mode; real-mode requires explicit OAuth token. Avoids accidental Anthropic API spend.
