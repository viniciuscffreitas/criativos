FROM node:20-alpine AS ui-builder
WORKDIR /app/features/web_gui/ui
COPY features/web_gui/ui/package.json features/web_gui/ui/package-lock.json ./
RUN npm ci
COPY features/web_gui/ui/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

# System deps: curl (healthcheck + Node installer), Node.js 20 LTS (for the
# `claude` CLI), then the CLI itself. The Python SDK is NOT installed — the
# copy_generation agent shells out to `claude -p` with CLAUDE_CODE_OAUTH_TOKEN
# (the Python SDK only accepts API keys).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g @anthropic-ai/claude-code \
    && npm cache clean --force

RUN pip install --no-cache-dir \
    "pyyaml>=6.0,<7.0" \
    "jinja2>=3.1,<4.0" \
    "fastapi>=0.115,<1.0" \
    "python-multipart>=0.0.9,<1.0" \
    "uvicorn[standard]>=0.32,<1.0" \
    "anyio>=4,<5" \
    "pillow>=10.4,<12.0" \
    "playwright>=1.47,<2.0"

# Playwright chromium binary + apt deps (libnss, libatk, libcups, etc).
# Without --with-deps the binary downloads fine but crashes at launch with
# "Host system is missing dependencies". The render service hits this every
# time POST /api/v1/render/* fires — the container would be a no-op without
# this layer.
RUN python -m playwright install --with-deps chromium

COPY features/ ./features/
COPY scripts/ ./scripts/
COPY ads/ ./ads/
COPY brand/ ./brand/
COPY config/ ./config/
COPY pyproject.toml ./

COPY --from=ui-builder /app/features/web_gui/static/ /app/features/web_gui/static/

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV VIBEWEB_DRY_RUN=1
ENV VIBEWEB_REQUIRE_UI=1
ENV VIBEWEB_REQUIRE_RENDERS=1

RUN mkdir -p features/web_gui/traces features/web_gui/uploads

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/api/v1/projects > /dev/null || exit 1

CMD ["uvicorn", "features.web_gui.server:app", "--host", "0.0.0.0", "--port", "8000"]
