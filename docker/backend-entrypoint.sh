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

# ── Cloudflare credentials, for the Article Genie only ────────────────────────
# backend/.dev.vars arrives wholesale (compose.yaml's env_file), and the
# committed example carries both names with no value — so they turn up as the
# empty string whenever nobody filled them in. That is worse than nothing:
# Wrangler treats a present-but-empty CLOUDFLARE_API_TOKEN as a credential to
# try, and fails authentication instead of running credential-free. Unset them
# here and the no-Genie path behaves exactly as it did before they existed.
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || unset CLOUDFLARE_API_TOKEN
[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] || unset CLOUDFLARE_ACCOUNT_ID

# Wrangler prefers CLOUDFLARE_API_TOKEN over an OAuth session and never opens a
# browser when it is set — which is what makes the Genie runnable in a container
# at all, since `wrangler login`'s callback listens on the *host's* localhost.
# Without a token it would fall through to that OAuth flow and hang on a URL
# nobody can open, so fail here instead — before the migrations, so a missing
# token costs a second rather than a full schema build. Only the Genie command
# needs this; `dev` binds no model.
case " $* " in
  *" devgenie "*)
    if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
      echo "==> The Article Genie needs Cloudflare credentials." >&2
      echo "    Workers AI has no local simulator, so every call is proxied to" >&2
      echo "    the real model and Wrangler has to authenticate." >&2
      echo >&2
      echo "    Fill CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID into" >&2
      echo "    backend/.dev.vars — the committed .dev.vars.example says" >&2
      echo "    how to create the token." >&2
      echo "    See docs/development/docker-local-dev.md#the-article-genie." >&2
      echo >&2
      echo "    Or run without it: ./gradlew noGenie" >&2
      exit 1
    fi
    echo "==> Article Genie on (CLOUDFLARE_API_TOKEN set)"
    ;;
esac

# D1's local state lives in a named volume, so this is a no-op after first boot
# and a full schema build on it. Cheap enough to run every time, and it means a
# new migration lands without anyone remembering a second command.
echo "==> Applying D1 migrations"
npm run db:init:local

exec "$@"
