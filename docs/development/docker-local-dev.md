---
title: Running FantasyWiki in Docker
type: development
tags: [docker, compose, setup, onboarding, ghcr]
related:
  - "[[local-dev-setup]]"
  - "[[article-genie-llm]]"
  - "[[deploy-strategy]]"
---

# Running FantasyWiki in Docker

For someone who wants to run FantasyWiki without installing Node, npm or Gradle,
and — the harder half — **without being handed any of the project's
credentials**.

```bash
git clone https://github.com/FantasyWiki/FantasyWiki.git
cd FantasyWiki
docker compose up
```

Then open <http://localhost:5173> and sign in with **Continue as demo player**.

That gives you an empty database to build in. For a populated one, run the
demo profile instead — see [The two modes](#the-two-modes).

There is nothing else to obtain: no Cloudflare account, no Google OAuth client
secret, no env file to fill in.

---

## What makes that possible

Two features would normally each stop a fresh clone dead, and each is switched
off rather than faked.

| Feature | Needs | Without it |
|---|---|---|
| **Article Genie** | A Cloudflare account (Workers AI) | The `local` environment binds no model, so the backend starts and the market shows no Genie at all — see [Article Genie LLM Integration](../architecture/article-genie-llm.md) |
| **Google sign-in** | The project's OAuth client secret | `GET /auth/dev` mints the same session without it |

### `/auth/dev`

It is the Google flow with the identity provider removed: the same
`LoginService` call, the same claims, the same `JWT_SECRET`, the same
`session_token` cookie, the same redirect to `/auth/callback`. The demo player
is an **ordinary player**, so nothing downstream knows this route exists.

It is gated twice, and the two gates do not trust each other:

- **Backend** — 404 unless `ENVIRONMENT` is `"local"`. Only the `local` and
  `local-genie` environments in `wrangler.jsonc` carry that value; `production`,
  `preview` and `test` do not. 404 rather than 403 because outside local
  development the route should not appear to exist at all.
- **Frontend** — the button renders only when the build was started with
  `VITE_DEV_LOGIN=true`.

`JWT_SECRET` is still required, but it is self-generated randomness, not a
shared credential: the container entrypoint writes a `backend/.dev.vars` from
the committed `.dev.vars.example` with a fresh random value when the file is
missing.

---

## The two modes

Both publish the same ports, so nothing about the app's URLs changes between
them.

### Development — the default

```bash
docker compose up
```

The repository is bind-mounted, so an edit on the host restarts Wrangler and
hot-reloads Vite. This is the mode for a collaborator who wants to write code
without installing the toolchain.

### Demo — built, no hot reload

```bash
docker compose -f compose.yaml -f compose.demo.yaml up --build
```

The sources are baked into the images and `vite preview` serves the built
bundle. Slower on the first build, nothing on the host to keep in step. This is
the form to hand to someone who wants to *see* FantasyWiki rather than work on
it.

---

## Filling the database

The two modes differ here, and deliberately.

**The demo profile arrives populated.** Its entrypoint seeds on every boot,
because that profile exists to be looked at and a second command standing
between a visitor and a working app is one too many. You get a public league,
*Wikipedia Premier*, with three rival teams — full 4-3-3 squads and four scored
days each — so the market shows owned articles, the standings rank somebody, and
the podium has a reason to appear.

**The default profile starts empty**, which is the honest state for someone
about to found their own league. To fill it anyway:

```bash
docker compose exec backend npm run db:seed:demo
```

Both paths run the same `backend/seeds/demo.sql` — deliberately **not** a
migration, because no deployed database should ever see it. It deletes its own
rows before reinserting them, so re-running it replaces the demo league rather
than stacking copies, and its timestamps are relative to `now`, so the season
never ages out from under the data. That is what makes seeding-on-every-boot
safe rather than merely first-run.

The switch is `SEED_DEMO_DATA=true`, set in `compose.demo.yaml` and unset
everywhere else — so nothing about host development changes.

The database lives in a named volume and survives `docker compose down`. To
start clean:

```bash
docker compose down -v
```

---

## Things that will bite

**Do not remap the ports.** `http://127.0.0.1:8787/auth/google` is registered
with Google as a redirect URI, and `FRONTEND_URL` feeds both that redirect and
the session cookie's `Secure` flag. 8787 and 5173 are effectively part of the
configuration.

**The installs are the container's, not yours.** Each `node_modules` sits in a
named volume mounted over the bind mount. The backend's `better-sqlite3` is a
native module, and a copy compiled on Windows or macOS cannot load inside a
Linux container. A mysterious `invalid ELF header` means one of those mounts is
missing.

**`127.0.0.1` means "this container".** Vite's dev proxy therefore reads
`BACKEND_ORIGIN` (`http://backend:8787` under Compose) rather than hardcoding
the loopback address it uses when both processes run on one machine. This is the
single likeliest thing to get wrong.

**Everything binds `0.0.0.0`.** Wrangler and Vite both bind loopback by default,
which is unreachable through a published port — hence `--ip 0.0.0.0` and
`VITE_HOST`.

**File watching polls.** Bind-mounted filesystems do not deliver inotify events
on Windows or macOS, so `CHOKIDAR_USEPOLLING` and `VITE_POLL` are set. It costs
some CPU; without it, edits are simply never noticed.

**Compose environment beats `.env.local`.** Vite lets a real environment
variable win over the file, so the container behaves the same whatever a
developer happens to have in their own `frontend/.env.local`.

**Sign in with Google fails in a container** unless `GOOGLE_CLIENT_SECRET` is
filled into `backend/.dev.vars` — the backend answers a raw 500. Use the demo
button, or supply the secret and both routes work.

---

## Publishing images

`.github/workflows/publish-images.yml` pushes to GHCR on `master` and `dev`,
behind the same gate as the Cloudflare deploys: an image is only worth
publishing for a revision that passed `check`. `GITHUB_TOKEN` is the whole
credential — no new secret, unlike the deploys next door.

Today it publishes the one service Cloudflare does not host:

| Image | Tags |
|---|---|
| `ghcr.io/fantasywiki/scoring-collector` | `sha-<short>` always, plus `latest` on `master` and `dev` on `dev` |

`sha-<short>` is the tag a rollback names; the branch aliases are what a human
or a compose file pulls.

Its Dockerfile is **runtime-only** — the Gradle distribution is built before the
image, not inside it. A Gradle stage would have to carry the whole monorepo,
because `settings.gradle.kts` configures the Node subprojects and installs git
hooks, all for a build the runner has already done with a warm cache. To build
it by hand:

```bash
./gradlew :scoring-collector:installDist
docker build -f docker/scoring-collector.Dockerfile -t scoring-collector .
```

Adding the backend and frontend demo images is one more entry in that workflow's
matrix, the day someone wants `docker compose pull` instead of a local build.

---

## Related

- [Local Development Setup](./local-dev-setup.md) — running it without Docker
- [Article Genie LLM Integration](../architecture/article-genie-llm.md) — why the Genie is optional
- [Deploy Strategy & Branch Policy](../deployment/deploy-strategy.md)
