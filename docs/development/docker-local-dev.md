---
title: Running FantasyWiki in Docker
type: development
tags: [docker, compose, setup, onboarding, ghcr]
related:
  - "[[local-dev-setup]]"
  - "[[article-genie-llm]]"
  - "[[scoring-pipeline]]"
  - "[[deploy-strategy]]"
---

# Running FantasyWiki in Docker

For someone who wants to run FantasyWiki without installing Node or npm, and,
the harder half, **without being handed any of the project's credentials**.

```bash
git clone https://github.com/FantasyWiki/FantasyWiki.git
cd FantasyWiki
./gradlew noGenie
```

Then open <http://localhost:5173> and sign in with **Continue as demo player**.

There is nothing else to obtain: no Cloudflare account, no Google OAuth client
secret, no env file to fill in. That gives you an empty database to build in,
and the Article Genie switched off, which is what `noGenie` names.

## The four commands

Two things about the stack are optional, and they switch independently, so
there are four combinations. Naming each one is the whole point: the
alternative is remembering which `-f` files and `--profile` flags compose into
which run, and getting it wrong at the worst moment.

| | Genie off | Genie on |
|---|---|---|
| **Empty database** | `./gradlew noGenie` | `./gradlew up` |
| **Seeded database** | `./gradlew demoNoGenie` | `./gradlew demo` |

- **Genie**: the Article Genie, the one feature that needs a Cloudflare
  account. On means the Worker runs wrangler's `local-genie` environment, which
  binds Workers AI; off means `local`, which binds no model. See
  [The Article Genie](#the-article-genie).
- **Demo**: whether the database arrives with the demo league in it. See
  [Filling the database](#filling-the-database).

Each task is a wrapper thin enough to read: it sets one environment variable and
runs `docker compose up`. `./gradlew tasks --group docker` prints all four, and
the raw form still works if you prefer it,

```bash
NPM_CMD=dev docker compose --profile demo up   # == ./gradlew demoNoGenie
```

`NPM_CMD` is the Genie axis (which npm script the backend container runs,
defaulting to `devgenie`) and `--profile demo` is the data axis. Gradle sets
`NPM_CMD` through the process environment rather than the command line, so the
tasks behave the same under bash, PowerShell and WSL.

---

## What makes that possible

Two features would normally each stop a fresh clone dead, and each is switched
off rather than faked.

| Feature | Needs | Without it |
|---|---|---|
| **Article Genie** | A Cloudflare account (Workers AI) | `noGenie` runs the `local` environment, which binds no model, so the backend starts and the market shows no Genie at all, see [Article Genie LLM Integration](../architecture/article-genie-llm.md) |
| **Google sign-in** | The project's OAuth client secret | `GET /auth/dev` mints the same session without it |

### `/auth/dev`

It is the Google flow with the identity provider removed: the same
`LoginService` call, the same claims, the same `JWT_SECRET`, the same
`session_token` cookie, the same redirect to `/auth/callback`. The demo player
is an **ordinary player**, so nothing downstream knows this route exists.

It is gated twice, and the two gates do not trust each other:

- **Backend**: 404 unless `ENVIRONMENT` is `"local"`. Only the `local` and
  `local-genie` environments in `wrangler.jsonc` carry that value; `production`,
  `preview` and `test` do not. 404 rather than 403 because outside local
  development the route should not appear to exist at all.
- **Frontend**: the button renders only when the build was started with
  `VITE_DEV_LOGIN=true`.

`JWT_SECRET` is still required, but it is self-generated randomness, not a
shared credential: the container entrypoint writes a `backend/.dev.vars` from
the committed `.dev.vars.example` with a fresh random value when the file is
missing.

---

## What Docker is not for

Compose is a **development** convenience, and it cannot become a deployment
target: the frontend is a Cloudflare Pages project and the backend a Worker,
both serverless. Nothing in production runs a container of this app, so no
`compose.yaml` here is ever `up` anywhere but a laptop. The one image the
project does ship, the Kotlin scoring collector, is not part of this stack;
it is [below](#publishing-images).

Two things are missing from the image, and they are missing for different
reasons. It carries Node but no JDK, the bind mount puts `gradlew` right there
in `/workspace` with nothing behind it, and the only Cloudflare credential it
is ever handed is the Genie's API token, which is narrower than the deploy
credential CI holds but is not read-only, see the note on Workers Scripts ·
Edit in [Creating a Cloudflare API token](./local-dev-setup.md#creating-a-cloudflare-api-token).
`noGenie` hands it none at all, which is what keeps a fresh clone runnable.

| | In a container | Natively |
|---|---|---|
| Run it, click around, sign in | ✅ | ✅ |
| Edit code with hot reload | ✅ | ✅ |
| `npm test` / `lint` / `format`, per subproject | ✅ | ✅ |
| `wrangler dev`, local D1 migrations, `cf-typegen` | ✅ | ✅ |
| The Article Genie | ✅ with an API token | ✅ with `wrangler login` |
| `./gradlew check --parallel`, the PR gate | ❌ no JDK | ✅ |
| `wrangler deploy`, `db:migrate:remote` | ❌ no Pages or D1 credential | ✅ |

So: **containers to run FantasyWiki, the native toolchain to ship it.** Anyone
opening a PR needs the second as well, which is what
[Local Development Setup](./local-dev-setup.md) installs, and that path needs
no Cloudflare account either, only a JDK.

---

## The Article Genie

`up` and `demo` run the Worker on wrangler's `local-genie` environment, which
binds Workers AI. Workers AI has **no local simulator**, so every call is
proxied to the real model on Cloudflare's edge and Wrangler has to authenticate.
That is the whole reason this needs credentials and `noGenie` does not.

### Why not `wrangler login`

Natively, `wrangler login` is the usual answer. It cannot work here: its OAuth
callback listens on `localhost:8976`, and inside a container that is the
*container's* localhost, the browser doing the consenting is on the host, and
nothing routes back. The flow would sit on a URL nobody can complete.

So use an **API token**, which Wrangler reads straight from the environment and
prefers over any stored OAuth session. No browser, no login step.

### Getting one

Creating the token is the same job whether you run in Docker or not, so it is
written once, next to the other credentials:
[Creating a Cloudflare API token](./local-dev-setup.md#creating-a-cloudflare-api-token).
The short version is the dashboard's
<https://dash.cloudflare.com/profile/api-tokens> → **Create Token** →
**Create Custom Token**, with *Workers Scripts · Edit* (needed for the remote
preview session, and the one everybody misses), *Workers AI · Read* and
*Account Settings · Read*.

What is specific to Compose is only where the two values go:

```bash
cp backend/.dev.vars.example backend/.dev.vars   # if you have none yet
```

Fill the two `CLOUDFLARE_*` values in at the bottom of that file. There is no
`.env` in the repository root and deliberately so: this project's local secrets
already have a home, and Compose passes the whole of `backend/.dev.vars` into
the container's environment (`env_file`), which is where Wrangler looks for
them. That file is gitignored and dockerignored, so it reaches neither a commit
nor an image layer.

One Compose detail worth knowing if you ever add a secret with a `$` in it: the
`env_file` entry carries `format: raw`, without which Compose expands `$` inside
the values it reads and the secret arrives silently truncated.

Then `./gradlew up`: the backend prints `==> Article Genie on` and the market
grows its Genie button.

Without a token, `up` and `demo` stop before Wrangler starts, with a message
naming this section, a clear failure rather than a hang on an OAuth flow that
cannot finish. `noGenie` and `demoNoGenie` are unaffected: Compose passes both
variables always, so an undefined one arrives as the *empty string*, and the
entrypoint unsets it. An empty token is worse than none, Wrangler would see a
credential, try it, and fail authentication instead of running credential-free.

Nothing else in the stack ever sees these variables. The token is not
read-only, though, the remote preview session forces Workers Scripts · Edit,
so it can publish a Worker, if not a Pages build or a D1 migration.

---

## Where the production bundle is

Not here. All four tasks bind-mount the repository and serve the frontend from
the Vite dev server, so an edit on the host restarts Wrangler and hot-reloads
Vite. They publish the same ports, so nothing about the app's URLs changes
between them.

There was once a second compose file that baked the sources in and served the
built bundle through `vite preview`. It was deleted, because the thing it was
for is done better elsewhere: every push to `dev` runs `npm run build` and
`wrangler pages deploy` (`.github/workflows/deploy-target.yml`), so the real
production bundle is already live at **<https://dev.fantasywiki.pages.dev>**,
against the real Worker and the real database, and at a URL you can send
someone, which a container on your laptop is not.

The backend never had a second mode to lose. `wrangler dev` is the only way to
run a Worker locally, so it runs the same command either way; only the frontend
had a dev/built split at all.

---

## Filling the database

The two answers differ deliberately.

**`demo` and `demoNoGenie` arrive populated.** You get a public league,
*Wikipedia Premier*, with three rival teams, full 4-3-3 squads and four scored
days each, so the market shows owned articles, the standings rank somebody, and
the podium has a reason to appear. A second command standing between a visitor
and a working app is one too many.

The `demo` Compose profile does this by adding a `db-seed` service that runs to
completion *before* the backend starts. It is the same image and the same
entrypoint, so it applies the migrations first and seeds a schema that exists,
and because the backend waits on it the two never hold the D1 files at once.

**`up` and `noGenie` start empty**, which is the honest state for someone about
to found their own league. To fill one anyway, without restarting:

```bash
docker compose exec backend npm run db:seed:demo
```

Both paths run the same `backend/seeds/demo.sql`, deliberately **not** a
migration, because no deployed database should ever see it. It deletes its own
rows before reinserting them, so re-running it replaces the demo league rather
than stacking copies, and its timestamps are relative to `now`, so the season
never ages out from under the data. That is what makes seeding-on-every-boot
safe rather than merely first-run.

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
which is unreachable through a published port, hence `--ip 0.0.0.0` and
`VITE_HOST`.

**File watching polls.** Bind-mounted filesystems do not deliver inotify events
on Windows or macOS, so `CHOKIDAR_USEPOLLING` and `VITE_POLL` are set. It costs
some CPU; without it, edits are simply never noticed.

**Compose environment beats `.env.local`.** Vite lets a real environment
variable win over the file, so the container behaves the same whatever a
developer happens to have in their own `frontend/.env.local`.

**`wrangler login` does nothing useful in a container.** Its OAuth callback
listens on `localhost:8976`, which inside a container is the container's own
loopback; the browser consenting is on the host and nothing routes back. Use a
`CLOUDFLARE_API_TOKEN` in `.env`, [The Article Genie](#the-article-genie).

**Sign in with Google fails in a container** unless `GOOGLE_CLIENT_SECRET` is
filled into `backend/.dev.vars`, the backend answers a raw 500. Use the demo
button, or supply the secret and both routes work.

---

## Publishing images

`.github/workflows/publish-images.yml` pushes to GHCR on `master` and `dev`,
behind the same gate as the Cloudflare deploys: an image is only worth
publishing for a revision that passed `check`. `GITHUB_TOKEN` is the whole
credential, no new secret, unlike the deploys next door.

Today it publishes the one service Cloudflare does not host:

| Image | Tags |
|---|---|
| `ghcr.io/fantasywiki/scoring-collector` | `sha-<short>` always, plus `latest` on `master` and `dev` on `dev` |

`sha-<short>` is the tag a rollback names; the branch aliases are what a human
or a compose file pulls.

Its Dockerfile is **runtime-only**, the Gradle distribution is built before the
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

### Running the collector

Publishing an image rather than building from source at run time buys two
things: the nightly scores exactly the artefact that passed `check` for master,
and **the nightly does not have to run on a GitHub runner at all**. Any host
that can pull the image and set three environment variables can own the day
instead. Both routes, the command each takes, and the repository variable that
hands over between them are in
[Nightly Scoring Pipeline](../architecture/scoring-pipeline.md#what-runs-and-where).

---

## Related

- [Local Development Setup](./local-dev-setup.md): running it without Docker
- [Article Genie LLM Integration](../architecture/article-genie-llm.md): why the Genie is optional
- [Nightly Scoring Pipeline](../architecture/scoring-pipeline.md): where the published image is actually run
- [Deploy Strategy & Branch Policy](../deployment/deploy-strategy.md)
