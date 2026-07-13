<div align="center">

<img src="./docs/assets/logo.png" alt="FantasyWiki" width="140">

# FantasyWiki

### **Fantasy football. But the players are Wikipedia articles.**

<!-- TAGLINE: one punchy line. Keep it concrete — name real articles. -->
*Your squad is only as good as the world's curiosity.*

[![CI/CD](https://github.com/FantasyWiki/FantasyWiki/actions/workflows/dispatcher.yml/badge.svg?branch=master)](https://github.com/FantasyWiki/FantasyWiki/actions/workflows/dispatcher.yml)
[![Backend coverage](https://img.shields.io/codecov/c/github/FantasyWiki/FantasyWiki/master?label=backend%20coverage)](https://codecov.io/gh/FantasyWiki/FantasyWiki)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue)](./LICENSE)

**🚧 Work in progress — the game is still being built, and this README grows with it.**

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
trends, a country makes the news — and the pageviews spike.

**FantasyWiki turns that into a game.** You get a budget, you buy article
contracts, you field a formation, and the world's curiosity does the rest.

Popularity alone won't win it. Articles are priced on their *30-day average*, so
the giants are expensive and the breakouts are cheap — and articles that link to
each other on Wikipedia score bonus **chemistry** when you place them side by
side. Pick well, and a clever mid-table squad beats a stack of superstars.

## The game in 30 seconds

| | |
|---|---|
| 📜 **Contracts** | Buy an article for a fixed term. Priced on its smoothed 30-day average — spikes are cheap, fame is not. |
| 📈 **Points** | Your articles score as they get read. The curve is logarithmic: doubling readers is worth a step, not a jackpot. |
| ⚡ **Chemistry** | Adjacent slots score bonus points when their articles link to each other on Wikipedia. Mutual links score best. |
| 🏅 **Leagues** | Play private leagues with friends. Contracts settle at expiry — profit or loss. Squad management never stops. |

<!--
╔══════════════════════════════════════════════════════════════════════════════╗
║ 🖼️ SLOT 2 — THE THREE-SHOT ROW. One still per pillar above.                   ║
║                                                                              ║
║ Static PNGs, not GIFs — this row is scanned, not watched. Pair each shot     ║
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
║ 🎬 SLOT 1 — THE HERO GIF. The most important image in this README.            ║
║                                                                              ║
║ Show the FORMATION PITCH with chemistry links drawn between article nodes.   ║
║ It is the one visual nothing else looks like — it says "fantasy football"    ║
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
| **Build** | Gradle-orchestrated monorepo over npm subprojects |
| **CI/CD** | GitHub Actions → Cloudflare Workers + Pages |

## Repository layout

```
FantasyWiki/
├── dto/            # Shared API shapes (frontend + backend)
├── model/          # Shared domain entities
├── external-apis/  # Wikimedia client (pageviews, article links)
├── backend/        # Cloudflare Worker: routes → services → repositories
├── frontend/       # Vue 3 + Ionic SPA
└── docs/           # Documentation, grouped by concept
```

## Quick start

**Prerequisites** — Node `24.18.0`, npm `11.18.0` (pinned in `engines`), and a JDK for the Gradle wrapper.

**1. Create the two env files.** Both are gitignored. Full walkthrough:
[`local-dev-setup.md`](./docs/development/local-dev-setup.md).

```bash
# backend/.dev.vars
GOOGLE_CLIENT_SECRET=...
JWT_SECRET=...
FRONTEND_URL=localhost:5173

# frontend/.env.local
VITE_BACKEND_URL=http://127.0.0.1:8787
VITE_MOCK=true
```

**2. Run it.** Gradle downloads its own Node and installs dependencies for you.

```bash
./gradlew devMock --parallel
```

> ⚠️ **`--parallel` is required** for any Gradle task that drives both
> subprojects. Without it they run sequentially and the second one never starts.

Frontend → <http://localhost:5173> · Backend → <http://127.0.0.1:8787>

With `VITE_MOCK=true`, MSW mocks every `/api/*` call *except* `/api/session` and
`/auth/*` — so you get a **real Google login** against **mocked game data**.

<!--
╔══════════════════════════════════════════════════════════════════════════════╗
║ 🎬 SLOT 3 (optional) — "it works" proof. A short GIF of the app booting on   ║
║ mock data: run the command, app loads, a team is already there. Reassures a  ║
║ contributor that one command really is all it takes. Skip if the hero GIF    ║
║ already carries the README — three visuals is the ceiling before it drags.   ║
╚══════════════════════════════════════════════════════════════════════════════╝
-->


## Commands

### Root — Gradle, both subprojects (always `--parallel`)

```bash
./gradlew devMock --parallel   # frontend (MSW-mocked) + backend
./gradlew dev     --parallel   # frontend (real API) + backend
./gradlew check   --parallel   # install, format, lint, test, audit — what CI runs
./gradlew fix     --parallel   # format + lint autofix
```

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
npm run cf-typegen       # regenerate CloudflareBindings from wrangler.jsonc
npm run db:init:local    # apply D1 migrations locally
```

Integration tests run in `@cloudflare/vitest-pool-workers`: they read
`wrangler.jsonc`, apply `backend/migrations/`, and reset D1 before each test.

## Deployment

Deploys are branch-based. Details: [`deploy-strategy.md`](./docs/deployment/deploy-strategy.md).

| Branch | Environment | Targets |
|---|---|---|
| `master` | 🚀 Production | Worker `backend`, Pages `frontend`, D1 `db` |
| `dev` | 🧪 QA | Worker `backend-preview`, Pages `frontend` (dev), D1 `db-preview` |
| `feature/*` · `renovate/*` | ✅ CI only | `./gradlew check`, no deploy |

## Documentation

**Start at [`docs/README.md`](./docs/README.md)** — the map of content.

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
section — so the tree doubles as an Obsidian-style knowledge graph while every
link stays clickable on GitHub.

## Contributing

- Speak the **domain vocabulary** from [`CONTEXT.md`](./CONTEXT.md) in code, comments, and commits.
- Follow [`api-naming-rules.md`](./docs/development/api-naming-rules.md) — identity is always resolved server-side from the session, never from a client-supplied `playerId`.
- npm scripts take **no separators**: `formatfix`, not `format:fix` ([why](./docs/development/npm-script-naming.md)).
- Docs are **lowercase kebab-case**, grouped by concept. State a rule once, then link to it.
- Commits follow **Conventional Commits** — enforced by a `commit-msg` hook Gradle installs.
- `./gradlew check --parallel` must pass before opening a PR.

## License

[GNU AGPL v3.0](./LICENSE) — network use counts as distribution, so deployed
modifications must publish their source.
