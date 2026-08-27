# syntax=docker/dockerfile:1
#
# The Vue/Ionic SPA: the Vite dev server with hot reload, proxying /api to the
# backend container. The production bundle is not built here — Cloudflare Pages
# builds and serves it (.github/workflows/deploy-target.yml).
#
# See docs/development/docker-local-dev.md.

ARG NODE_VERSION=24.18.1

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix frontend

WORKDIR /workspace/frontend
EXPOSE 5173

# ── dev ───────────────────────────────────────────────────────────────────────
# The only stage, named because compose.yaml asks for it by name.
FROM deps AS dev
# VITE_HOST rather than a --host flag, so it survives whatever command runs.
ENV VITE_HOST=0.0.0.0 \
    VITE_POLL=true
CMD ["npm", "run", "dev"]
