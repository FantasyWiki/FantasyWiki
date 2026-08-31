<div align="center">

<img src="./docs/assets/logo.png" alt="FantasyWiki" width="140">

# FantasyWiki

### **Fantasy football. But the players are Wikipedia articles.**

<!-- TAGLINE: one punchy line. Keep it concrete, name real articles. -->
*Your squad is only as good as the world's curiosity.*

[![CI/CD](https://github.com/FantasyWiki/FantasyWiki/actions/workflows/dispatcher.yml/badge.svg?branch=master)](https://github.com/FantasyWiki/FantasyWiki/actions/workflows/dispatcher.yml)
[![Backend coverage](https://img.shields.io/codecov/c/github/FantasyWiki/FantasyWiki/master?label=backend%20coverage)](https://codecov.io/gh/FantasyWiki/FantasyWiki)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue)](./LICENSE)

**🚧 Work in progress, the game is still being built, and this README grows with it.**

<br>

[![Technical documentation](https://img.shields.io/badge/Technical%20documentation-Read%20it-1e7e50?style=for-the-badge&logo=readthedocs&logoColor=white&labelColor=14603c)](https://fantasywiki.github.io/FantasyWiki/)
[![Exam report](https://img.shields.io/badge/Exam%20report-Single%20page-6b7280?style=for-the-badge&logo=markdown&logoColor=white&labelColor=374151)](https://fantasywiki.github.io/FantasyWiki/report.html)

**[fantasywiki.github.io/FantasyWiki](https://fantasywiki.github.io/FantasyWiki/)**, architecture,
data flow, the domain glossary and a live coverage board, built from this
repository on every push.

</div>

---

## Table of contents

- [What is this?](#what-is-this)
- [The game in 30 seconds](#the-game-in-30-seconds)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [Commands](#commands)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## What is this?

Every day, millions of people read Wikipedia. A footballer scores, a celebrity
trends, a country makes the news, and the pageviews spike.

**FantasyWiki turns that into a game.** You get a budget, you buy article
contracts, you field a formation, and the world's curiosity does the rest.

Popularity alone won't win it. Articles are priced on their *30-day average*, so
the giants are expensive and the breakouts are cheap, and articles that link to
each other on Wikipedia score bonus **chemistry** when you place them side by
side. Pick well, and a clever mid-table squad beats a stack of superstars.

## The game in 30 seconds

| | |
|---|---|
| 📜 **Contracts** | Buy an article for a fixed term. Priced on its smoothed 30-day average, spikes are cheap, fame is not. |
| 📈 **Points** | Your articles score as they get read. The curve is logarithmic: doubling readers is worth a step, not a jackpot. |
| ⚡ **Chemistry** | Adjacent slots score bonus points when their articles link to each other on Wikipedia. Mutual links score best. |
| 🏅 **Leagues** | Play private leagues with friends. Contracts settle at expiry, profit or loss. Squad management never stops. |

<!--
╔══════════════════════════════════════════════════════════════════════════════╗
║ 🖼️ SLOT 2, THE THREE-SHOT ROW. One still per pillar above.                   ║
║                                                                              ║
║ Static PNGs, not GIFs, this row is scanned, not watched. Pair each shot     ║
║ with the row it illustrates: the market (buying), the pitch (chemistry),     ║
║ the league table (competing). Same device frame + same theme for all three,  ║
║ or the row looks like a collage instead of a product.                        ║
╚══════════════════════════════════════════════════════════════════════════════╝

<table>
  <tr>
    <td width="33%"><img src="./docs/assets/market.png" alt="Buying an article contract"></td>
    <td width="33%"><img src="./docs/assets/formation.png" alt="The formation pitch"></td>
    <td width="33%"><img src="./docs/assets/league.png" alt="League standings"></td>
  </tr>
  <tr align="center">
    <td><b>Buy</b></td>
    <td><b>Build</b></td>
    <td><b>Compete</b></td>
  </tr>
</table>
-->



Full rules: [`docs/domain/`](./docs/domain/) · Vocabulary: [`CONTEXT.md`](./CONTEXT.md)

<!--
╔══════════════════════════════════════════════════════════════════════════════╗
║ 🎬 SLOT 1, THE HERO GIF. The most important image in this README.            ║
║                                                                              ║
║ Show the FORMATION PITCH with chemistry links drawn between article nodes.   ║
║ It is the one visual nothing else looks like, it says "fantasy football"    ║
║ and "Wikipedia" in a single frame, with no caption needed.                   ║
║                                                                              ║
║ Best version: a GIF of dragging an article onto a slot and watching a link   ║
║ snap from gray (empty) → gold (excellent). That single motion explains       ║
║ chemistry better than the paragraph above it.                                ║
║                                                                              ║
║ ~10s, silent, looping. Full width. Drop it in docs/assets/ and uncomment:    ║
╚══════════════════════════════════════════════════════════════════════════════╝

<div align="center">
  <img src="./docs/assets/formation-chemistry.gif" alt="Placing an article and watching chemistry links light up" width="100%">
</div>
-->

## Tech stack

| Layer | Stack |
|---|---|
| **Frontend** | Vue 3 · Ionic · Pinia · TanStack Query · Vite |
| **Backend** | Cloudflare Workers · Hono |
| **Database** | Cloudflare D1 |
| **Auth** | Google OAuth → HTTP-only cookie with a signed JWT |
| **Shared** | Framework-agnostic TypeScript (`dto/`, `model/`) |
| **Nightly scoring** | Kotlin/JVM batch, delivered as a container image on GHCR |
| **Build** | Gradle-orchestrated monorepo over npm subprojects |
| **CI/CD** | GitHub Actions → Cloudflare Workers + Pages |
| **Local dev** | Docker Compose, optional, see [Quick start](#quick-start) |

## Repository layout

```
FantasyWiki/
├── dto/                # Shared API shapes (frontend + backend)
├── model/              # Shared domain entities
├── external-apis/      # Wikimedia client (pageviews, article links)
├── backend/            # Cloudflare Worker: routes → services → repositories
├── frontend/           # Vue 3 + Ionic SPA
├── scoring-collector/  # Kotlin nightly batch, the one service Cloudflare does not host
├── docker/             # Dockerfiles, one per service
├── compose.yaml        # Local stack, driven by ./gradlew up | noGenie | demo | demoNoGenie
└── docs/               # Documentation, grouped by concept
```

## Quick start

**Run it in Docker.** One command, and it asks you for nothing: no accounts, no
secrets, not even Node. The native toolchain is the
[alternative](#on-your-machine-instead), and you need it only to *ship*.

### In Docker

**Prerequisites**, Docker with Compose v2, and a JDK for the Gradle wrapper.

```bash
git clone https://github.com/FantasyWiki/FantasyWiki.git
cd FantasyWiki
./gradlew noGenie
```

Open <http://localhost:5173> and sign in with **Continue as demo player**.
There is nothing to obtain first: no Cloudflare account, no Google OAuth client
secret, no env file to fill in. The repository is bind-mounted, so an edit on
your machine hot-reloads inside the containers.

Two things are optional and switch independently, so there are four commands and
one name for each. **Genie** is the Article Genie, the single feature that needs
a Cloudflare account; `backend/.dev.vars.example` says how to get a token.
**Demo** seeds the database with a public league, rival squads and scored days,
for when you would rather look at FantasyWiki than start it empty.

| | Genie off | Genie on |
|---|---|---|
| **Empty database** | `./gradlew noGenie` | `./gradlew up` |
| **Seeded database** | `./gradlew demoNoGenie` | `./gradlew demo` |

Each is a one-line wrapper around `docker compose up`, so the raw commands still
work if you prefer them, `./gradlew tasks --group docker` prints what each one
runs. Everything in full:
[`docker-local-dev.md`](./docs/development/docker-local-dev.md).

### On your machine instead

Two things genuinely need the native toolchain, and both are about the
serverless platform rather than the app:

- **Shipping.** The frontend is a Cloudflare Pages project and the backend a
  Worker, so `wrangler deploy` and `wrangler pages deploy` are how anything
  reaches production, nothing here is ever deployed as an image. The only
  credential the containers ever hold is the Article Genie's token, which is
  narrower than that (no Pages, no D1).
- **`./gradlew check --parallel`, the PR gate.** The image carries Node but no
  JDK; the bind mount puts `gradlew` in front of you with nothing behind it.

Plus the obvious third reason: you would rather not run Docker. Everything else
works in both, the suites, the linters, `wrangler dev`, local D1 migrations,
and the full split is in
[`docker-local-dev.md`](./docs/development/docker-local-dev.md#what-docker-is-not-for).

**Prerequisites**, Node `24.18.0`, npm `11.18.0` (pinned in `engines`), and a JDK for the Gradle wrapper.

**1. Create the two env files.** Both are gitignored, and a `.example` sits
beside each as its checked-in shape. Full walkthrough:
[`local-dev-setup.md`](./docs/development/local-dev-setup.md).

```bash
cp backend/.dev.vars.example backend/.dev.vars
cp frontend/.env.local.example frontend/.env.local
```

`.dev.vars` leaves two blanks. `JWT_SECRET` is any random 32+ characters you
generate yourself. `GOOGLE_CLIENT_SECRET` is the only thing here you have to be
*given*, and you can skip it, exactly as the containers do, by uncommenting
`VITE_DEV_LOGIN=true` in `frontend/.env.local` and signing in as the demo
player.

**2. Run it.** Gradle downloads its own Node and installs dependencies for you.
This one needs no Cloudflare account, of the Gradle tasks, only `dev` does.

```bash
./gradlew devMock --parallel
```

> ⚠️ **`--parallel` is required** for any Gradle task that drives both
> subprojects. Without it they run sequentially and the second one never starts.

Frontend → <http://localhost:5173> · Backend → <http://127.0.0.1:8787>

With `VITE_MOCK=true`, MSW mocks every `/api/*` call *except* `/api/session` and
`/auth/*`, so you get a **real Google login** against **mocked game data**.

<!--
╔══════════════════════════════════════════════════════════════════════════════╗
║ 🎬 SLOT 3 (optional), "it works" proof. A short GIF of the app booting on   ║
║ mock data: run the command, app loads, a team is already there. Reassures a  ║
║ contributor that one command really is all it takes. Skip if the hero GIF    ║
║ already carries the README, three visuals is the ceiling before it drags.   ║
╚══════════════════════════════════════════════════════════════════════════════╝
-->


## Commands

### Root, Gradle, both subprojects (always `--parallel`)

```bash
./gradlew devMock    --parallel   # frontend (MSW-mocked) + backend
./gradlew devNoGenie --parallel   # frontend (real API) + backend
./gradlew dev        --parallel   # ...and the Article Genie (needs Cloudflare)
./gradlew check      --parallel   # install, format, lint, test, audit, what CI runs
./gradlew fix        --parallel   # format + lint autofix
```

The Docker equivalents, `up`, `noGenie`, `demo`, `demoNoGenie`, need no
`--parallel`, since Compose runs the services. See [In Docker](#in-docker).

### Frontend (`cd frontend`)

```bash
npm run dev           # Vite dev server
npm run build         # vue-tsc typecheck + build
npm run test          # vitest, single run
npm run hot-test      # vitest watch
npm run lint          # + lintfix
npm run format        # + formatfix
npm run g:component   # Plop: scaffold a view + spec
```

Single file: `npx vitest run src/tests/auth/LoginPage.spec.ts`

### Backend (`cd backend`)

```bash
npm run dev              # wrangler dev --env local (runs D1 migrations first)
npm run test             # vitest on the Workers pool
npm run test:integration # integration suite, single run
npm run test-coverage    # coverage → Codecov in CI
npm run typecheck        # tsc --noEmit, source and tests
npm run cf-typegen       # regenerate CloudflareBindings from wrangler.jsonc
npm run db:init:local    # apply D1 migrations locally
```

Tests run in `@cloudflare/vitest-pool-workers` against a real D1 database: they read
`wrangler.jsonc` and reset it before each test by dropping the schema and replaying
`backend/migrations/`. Which layer a test may name, and why the suite can be pointed at a
second persistence implementation, is in
[`backend-testing.md`](./docs/development/backend-testing.md).

## Deployment

Deploys are branch-based. Details: [`deploy-strategy.md`](./docs/deployment/deploy-strategy.md).

| Branch | Environment | Targets |
|---|---|---|
| `master` | 🚀 Production | Worker `backend`, Pages `frontend`, D1 `db` |
| `dev` | 🧪 QA | Worker `backend-preview`, Pages `frontend` (dev), D1 `db-preview` |
| `feat/*` · `renovate/*` | ✅ CI only | `./gradlew check`, no deploy |

The Kotlin **scoring collector** is the exception, because Cloudflare hosts
nothing that is not a Worker or a Page. It ships as a container image to GHCR
and the nightly runs that image, on a GitHub runner by default, or on anything
else that can pull it. Both options, and the switch between them:
[`scoring-pipeline.md`](./docs/architecture/scoring-pipeline.md#what-runs-and-where).

## Documentation

**📚 [fantasywiki.github.io/FantasyWiki](https://fantasywiki.github.io/FantasyWiki/)**, the
technical documentation site: architecture and data-flow diagrams, a live
coverage board, and an interactive **Docs Atlas** that draws every link between
these documents. It is built from this repository on every push to `master`, so
it cannot drift from what is written here.

**[Read it as one page](https://fantasywiki.github.io/FantasyWiki/report.html)**,
every page of the site assembled into a single document, for reading straight
through rather than navigating.

**Start at [`docs/README.md`](./docs/README.md)**, the same map of content, in
the repository.

| Where | What's in it |
|---|---|
| 📖 [`CONTEXT.md`](./CONTEXT.md) | **The domain glossary. Read this first.** |
| 🎲 [`docs/domain/`](./docs/domain/) | Game rules: scoring, economy, chemistry, lineups |
| 🏗️ [`docs/architecture/`](./docs/architecture/) | Code seams: backend layering, DTOs, Wikimedia client |
| 🛠️ [`docs/development/`](./docs/development/) | Local setup and naming conventions |
| 🚢 [`docs/deployment/`](./docs/deployment/) | Branch policy and Cloudflare setup |
| ⚖️ [`docs/adr/`](./docs/adr/) | Numbered decisions. **ADRs win any disagreement.** |
| ✨ [`PRODUCT.md`](./PRODUCT.md) · [`DESIGN.md`](./DESIGN.md) | Product vision and UI tone |

Every doc carries `title`/`type`/`tags` frontmatter and ends with a `## Related`
section, so the tree is a graph as well as a folder, and every link stays a
plain relative link, clickable on GitHub. That graph is what the
[Docs Atlas](https://fantasywiki.github.io/FantasyWiki/#the-docs-atlas) draws.

Adding to the docs? Read
[`docs/agents/documentation-site.md`](./docs/agents/documentation-site.md) first.

## Contributing

- Speak the **domain vocabulary** from [`CONTEXT.md`](./CONTEXT.md) in code, comments, and commits.
- Follow [`api-naming-rules.md`](./docs/development/api-naming-rules.md): identity is always resolved server-side from the session, never from a client-supplied `playerId`.
- npm scripts take **no separators**: `formatfix`, not `format:fix` ([why](./docs/development/npm-script-naming.md)).
- Docs are **lowercase kebab-case**, grouped by concept. State a rule once, then link to it.
- Commits follow **Conventional Commits**: enforced by a `commit-msg` hook Gradle installs.
- `./gradlew check --parallel` must pass before opening a PR.

## License

[GNU AGPL v3.0](./LICENSE): network use counts as distribution, so deployed
modifications must publish their source.
