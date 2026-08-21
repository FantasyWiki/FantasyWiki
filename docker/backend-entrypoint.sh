#!/bin/sh
# Everything that has to be true before Wrangler starts, done here rather than
# in the Dockerfile because it depends on the volumes, not on the image.
set -e

cd /workspace/backend

# The one secret this needs is one it can invent. `.dev.vars` is gitignored, so
# a fresh clone has none; the committed example is its shape, and JWT_SECRET is
# self-generated randomness rather than a shared credential — nothing else has
# to verify it. GOOGLE_CLIENT_SECRET is left blank on purpose: /auth/dev is how
# you sign in without Google (docs/development/docker-local-dev.md).
if [ ! -f .dev.vars ]; then
  echo "==> No backend/.dev.vars — writing one from .dev.vars.example"
  sed "s|^JWT_SECRET=.*|JWT_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')|" \
    .dev.vars.example > .dev.vars
fi

# D1's local state lives in a named volume, so this is a no-op after first boot
# and a full schema build on it. Cheap enough to run every time, and it means a
# new migration lands without anyone remembering a second command.
echo "==> Applying D1 migrations"
npm run db:init:local

# Opt-in, and only the demo profile opts in. The default `docker compose up`
# leaves the database empty, which is the honest thing for someone about to
# build their own league; the demo profile exists to be looked at, and a second
# command standing between a visitor and a populated app is one too many.
#
# Safe on every boot rather than only the first: the seed deletes its own rows
# before reinserting them, so this replaces the demo league instead of stacking
# copies of it, and a schema change picked up by the migrations above is
# followed by data that matches.
if [ "$SEED_DEMO_DATA" = "true" ]; then
  echo "==> Seeding demo data (SEED_DEMO_DATA=true)"
  npm run db:seed:demo
fi

exec "$@"
