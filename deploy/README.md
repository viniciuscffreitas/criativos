# Vibe Web — VPS Deploy

Production deploy on a Linux VPS (tested on Debian/Ubuntu) behind Caddy reverse proxy.

## Ops-center REST surface (call from any agent)

The deployed web app exposes the entire asset pipeline as REST endpoints. Any
agent — Claude Code, a script, n8n, curl from your laptop — can trigger
renders without needing the source tree on disk. Outputs land in docker
volumes (`brand/social/renders/`, `brand/favicons/`, `ads/renders/`,
`features/instagram_content/renders/`) and persist across `bash deploy/install.sh`
rebuilds, so the VPS itself is the source of truth for generated assets.

### Render endpoints

```bash
# Enumerate every PNG the pipeline can produce (67 expected outputs across
# brand pack, Meta ads, and Instagram content).
curl https://criativos.vinicius.xyz/api/v1/render/manifest | jq

# Trigger a render. Synchronous — returns when done. Approximate durations:
#   brand     ~6 s   (15 PNGs: logos + social + favicons)
#   ads       ~3 s   (6 PNGs)
#   instagram ~25 s  (48 PNGs)
#   all       ~35 s  (sequence of the above)
curl -X POST https://criativos.vinicius.xyz/api/v1/render/brand
curl -X POST 'https://criativos.vinicius.xyz/api/v1/render/ads?ad_id=01'
curl -X POST 'https://criativos.vinicius.xyz/api/v1/render/instagram?stem=single-manifesto'
curl -X POST https://criativos.vinicius.xyz/api/v1/render/all
```

After a successful render, the PNGs are immediately served at:

| Category | URL prefix |
|---|---|
| Brand (logos / social / favicons) | `/brand/...` |
| Meta Ads | `/renders/...` |
| Instagram content | `/instagram/...` |

### Copy generation (LLM)

```bash
curl -X POST https://criativos.vinicius.xyz/api/v1/generate \
  -H 'content-type: application/json' \
  -d '{"project_slug":"vibeweb","ad_id":"01","methodology":"pas","n_variants":3,"persist":true}'
```

Streaming variant (SSE):

```bash
curl -N -X POST https://criativos.vinicius.xyz/api/v1/generate/stream \
  -H 'content-type: application/json' \
  -d '{"project_slug":"vibeweb","ad_id":"01","methodology":"pas","n_variants":3,"persist":false}'
```

### UI counterpart

The same render endpoints power the web UI's **Studio** view (⌘4 / Ctrl+4).
The UI shows the manifest grouped by category with per-category "Generate"
buttons — exactly what the REST surface does, just visual.

### Auth note

The render endpoints are currently unauthenticated. Caddy on a personal
domain is the only gate. If exposed publicly long-term, add a token check
in `features/web_gui/api/render.py` as a follow-up.

---

## One-time bootstrap

This repo ships **two** reverse-proxy options. Pick whichever matches your VPS:

| Reverse proxy already on the box | Use config |
|---|---|
| Caddy (auto TLS) | `deploy/Caddyfile` |
| nginx + certbot (system pkgs) | `deploy/criativos.nginx.conf` (auto-installed by `install.sh` if it detects `/etc/nginx/sites-enabled/`) |

### Option A — Fresh box (Caddy)

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git caddy curl
sudo usermod -aG docker vinicius
newgrp docker

cd /home/vinicius
git clone https://github.com/viniciuscffreitas/criativos.git
cd criativos
cp .env.example .env && nano .env       # set CLAUDE_CODE_OAUTH_TOKEN

sudo cp deploy/Caddyfile /etc/caddy/Caddyfile.criativos
echo 'import Caddyfile.criativos' | sudo tee -a /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### Option B — Box already has nginx + certbot (the vinicius.xyz pattern)

```bash
cd /home/vinicius
git clone https://github.com/viniciuscffreitas/criativos.git
cd criativos
cp .env.example .env && nano .env       # set CLAUDE_CODE_OAUTH_TOKEN

# nginx vhost + Let's Encrypt cert
sudo cp deploy/criativos.nginx.conf /etc/nginx/sites-available/criativos.conf
sudo ln -sfn /etc/nginx/sites-available/criativos.conf /etc/nginx/sites-enabled/criativos.conf
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y python3-certbot-nginx
sudo certbot --nginx --non-interactive --agree-tos -m you@example.com -d criativos.vinicius.xyz --redirect
```

### DNS

Point `criativos.vinicius.xyz` (A record) at the VPS IP. This is out of scope
for the script.

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
- **Volumes for `config/`, `traces/`, `uploads/` and the four render output dirs**: persisted across rebuilds so re-deploying doesn't lose project YAML, run history, or web-app-generated PNGs. Without the render-output volumes the Studio view's `Gerar` actions would write into the container overlay and lose everything on next `bash deploy/install.sh`.
- **`VIBEWEB_DRY_RUN=1` default**: safe demo mode; real-mode requires explicit OAuth token. Avoids accidental Anthropic API spend.
