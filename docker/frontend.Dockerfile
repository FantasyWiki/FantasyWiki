# syntax=docker/dockerfile:1
#
# The Vue/Ionic SPA. In dev this is the Vite dev server with hot reload; in demo
# it is the built bundle served by `vite preview`, which also carries the same
# backend proxy so the two modes route identically.
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
FROM deps AS dev
# VITE_HOST rather than a --host flag, so the same knob works for `preview`.
ENV VITE_HOST=0.0.0.0 \
    VITE_POLL=true
CMD ["npm", "run", "dev"]

# ── demo ──────────────────────────────────────────────────────────────────────
FROM deps AS build
# Back up to the monorepo root: `deps` left WORKDIR at /workspace/frontend, and
# copying the shared packages relative to *that* buries them a level down where
# nothing resolves them.
WORKDIR /workspace
COPY dto ./dto
COPY model ./model
COPY external-apis ./external-apis
COPY frontend ./frontend
WORKDIR /workspace/frontend
# Baked in at build time: Vite substitutes VITE_* into the bundle, so these
# cannot be changed by an environment variable afterwards.
ARG VITE_BACKEND_URL=http://127.0.0.1:8787
ARG VITE_MOCK=false
ARG VITE_DEV_LOGIN=true
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL} \
    VITE_MOCK=${VITE_MOCK} \
    VITE_DEV_LOGIN=${VITE_DEV_LOGIN}
RUN npm run build

FROM build AS demo
ENV VITE_HOST=0.0.0.0
CMD ["npm", "run", "preview"]
