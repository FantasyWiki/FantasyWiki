# syntax=docker/dockerfile:1
#
# The Cloudflare Worker, run by Wrangler exactly as it is on a developer's own
# machine — `wrangler dev` is the only way to run a Worker locally, container or
# not. The sources arrive through a bind mount, so an edit on the host restarts
# the Worker without a rebuild.
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
#
# `dev` and not `devgenie`: this default is what a bare `docker run` of the
# image gets, and that has no Cloudflare credentials, so the Genie environment
# would refuse to start. Under Compose it never applies — compose.yaml always
# passes a command, and *its* default is `devgenie`.
CMD ["npm", "run", "dev", "--", "--ip", "0.0.0.0"]

# ── dev ───────────────────────────────────────────────────────────────────────
# The only stage. It is named rather than implicit because compose.yaml asks for
# it by name, and because a stage that bakes the sources in would go here beside
# it the day one is needed.
FROM deps AS dev
