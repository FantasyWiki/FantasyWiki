# syntax=docker/dockerfile:1
#
# The Cloudflare Worker, run by Wrangler exactly as it is on a developer's own
# machine — `wrangler dev` is the only way to run a Worker locally, so the demo
# image runs the same command as the dev one and differs only in whether the
# sources are baked in or mounted.
#
# See docs/development/docker-local-dev.md.

ARG NODE_VERSION=24.18.1

FROM node:${NODE_VERSION}-bookworm-slim AS deps

# better-sqlite3 is a native module. It ships prebuilt binaries for common
# platforms, but a toolchain has to be here for the versions where it doesn't,
# or `npm ci` fails with a compiler error that reads like a network problem.
RUN apt-get update \
  && apt-get install --no-install-recommends -y python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Manifests first, sources later: the install layer is the slow one and only
# has to be rebuilt when a dependency actually changes.
COPY package.json package-lock.json ./
RUN npm ci
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend

COPY docker/backend-entrypoint.sh /usr/local/bin/backend-entrypoint
RUN chmod +x /usr/local/bin/backend-entrypoint

WORKDIR /workspace/backend
EXPOSE 8787
ENTRYPOINT ["backend-entrypoint"]
# --ip 0.0.0.0: Wrangler binds loopback by default, which inside a container is
# reachable only from that same container, published port or not.
CMD ["npm", "run", "dev", "--", "--ip", "0.0.0.0"]

# ── dev ───────────────────────────────────────────────────────────────────────
# Sources arrive through a bind mount, so edits are picked up without a rebuild.
FROM deps AS dev

# ── demo ──────────────────────────────────────────────────────────────────────
# Self-contained: `docker run` with no repository checkout anywhere.
FROM deps AS demo
WORKDIR /workspace
# The Worker imports from ../../dto, ../../model and ../../external-apis, so the
# unit of copying is the monorepo, not the subproject.
COPY dto ./dto
COPY model ./model
COPY external-apis ./external-apis
COPY backend ./backend
WORKDIR /workspace/backend
