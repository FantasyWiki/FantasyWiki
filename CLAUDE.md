# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

FantasyWiki is a fantasy-sports-style game built on top of Wikipedia article pageview trends (see `PRODUCT.md`). Players buy/manage "article contracts," build formations, and compete in leagues. Domain terminology (Top Read Snapshot, Article Availability, Chemistry Link, etc.) is canonically defined in `CONTEXT.md` — use that vocabulary in code, comments, and commit messages rather than ad-hoc synonyms.

## Repository layout

This is a Gradle-orchestrated monorepo with two Node subprojects plus shared TypeScript packages:

```
FantasyWiki/
├── dto/        # Shared DTOs (API request/response shapes) used by both frontend and backend
├── model/      # Shared domain model types
├── backend/    # Cloudflare Worker (Hono)
└── frontend/   # Vue 3 + Ionic SPA
```

## Common commands

### Root (Gradle, runs both subprojects)

```bash
./gradlew check      # npm_ci + frontend:check + backend:check (format, lint, test, audit)
./gradlew dev        # frontend devNoMock + backend wrangler dev
./gradlew devMock    # frontend devMock (MSW) + backend wrangler dev
./gradlew fix        # frontend/backend formatfix + lintfix
```

### Frontend (`cd frontend`)

```bash
npm run dev          # vite dev server
npm run build         # vue-tsc + vite build
npm run test          # vitest run (all unit tests)
npm run hot-test       # vitest watch mode
npm run lint / lintfix
npm run format / formatfix
npm run g:component   # Plop generator: creates src/views/<Name>.vue + src/tests/<Name>.spec.ts
```

Run a single test file:

```bash
npx vitest run src/tests/auth/LoginPage.spec.ts
```

### Backend (`cd backend`)

```bash
npm run dev              # wrangler dev --env local (runs D1 migrations first via Gradle)
npm run test             # vitest run (Cloudflare Workers pool) — what Gradle check runs
npm run test:integration # vitest run --config vitest.config.ts (single run)
npm run test-coverage    # coverage report (uploaded to Codecov in CI)
npm run lint / lintfix
npm run format / formatfix
npm run cf-typegen        # regenerate CloudflareBindings types from wrangler.jsonc
npm run db:init:local     # apply D1 migrations locally
npm run db:migrate:remote  # apply D1 migrations to remote D1
```

Backend integration tests use `@cloudflare/vitest-pool-workers`, load config from `wrangler.jsonc`, apply migrations from `backend/migrations/`, and reset D1 data before each test. Tests live under `backend/src/tests/integration`.

## Architecture

### Backend (`backend/src`)

Layered structure, each layer only talks to the one below it:

1. **Routes** (`routes/`) — parse input, enforce auth/HTTP constraints, call services, map results to HTTP responses. Currently `auth.ts`, `leagues.ts`, `session.ts`.
2. **Services** (`services/`) — business logic/orchestration. Depend on repository *interfaces*, return typed `Result` values consumed by routes.
3. **Repositories** (`repositories/`) — define contracts (e.g. `playerRepository.ts`) with D1 implementations under `repositories/d1/` (e.g. `playerRepositoryD1.ts`). SQL and persistence error handling live here.

Runtime is a Cloudflare Worker using Hono (`backend/src/index.ts`), with Cloudflare D1 as primary persistence via the `db` binding. When instantiating Hono, pass `CloudflareBindings` as the generic: `new Hono<{ Bindings: CloudflareBindings }>()`.

### Frontend (`frontend/src`)

Vue 3 + Ionic SPA. Pinia stores (composition-style, `defineStore("id", () => ...)`) hold app/UI state; TanStack Query handles remote server state. Persistent UI state is manually synced to `localStorage` inside store actions.

Bootstrapping (`frontend/src/main.ts`) order matters:
1. If `VITE_MOCK === "true"`, start MSW (`src/mocks/browser`) and await `worker.start()` before anything else.
2. Create the Vue app and register router, Ionic, Pinia, VueQuery.
3. Await `router.isReady()`, then mount.

Tests also run through MSW with `onUnhandledRequest: "error"` (`frontend/src/tests/setup.ts`).

### Auth flow (cookie-based JWT)

- Google OAuth handled by `@hono/oauth-providers/google` in `backend/src/routes/auth.ts`.
- Backend signs a JWT and stores it in an HTTP-only `session_token` cookie.
- `/api/*` routes are protected by Hono JWT middleware reading that cookie.
- Frontend calls APIs with `credentials: "include"` (`frontend/src/services/api.ts`) and fetches session user info from `/api/session`.

## Key conventions

- **Shared packages**: `dto/` (API DTOs) and `model/` (domain models) are consumed by both frontend and backend — keep them framework-agnostic.
- **API design**: follow `docs/development/api-naming-rules.md` — plural nouns for collections, `/api/me` and `my-` prefix for self-scoped data (never take `playerId` from the client), don't repeat path identifiers in request bodies, and resolve identity/authorization from the session/JWT server-side (hiding `playerId` from URLs is not a security control).
- **npm script naming**: use camelCase with no separators (`formatfix`, `lintfix`), not `format:fix` or `format_fix` — Gradle's node plugin misinterprets `:` (subproject notation) and `_` (treated as a space). See `docs/development/npm-script-naming.md`.
- **Import alias**: use `@/` for frontend `src` imports (configured in Vite/tsconfig).
- **Temporal DTOs**: backend responses carrying `@js-temporal/polyfill` Temporal types must be explicitly deserialized on the frontend (`Temporal.Instant.from`, `Temporal.Duration.from`) in service-layer helpers.
- **Theming**: use Ionic CSS vars from `frontend/src/theme/variables.css` (e.g. `--ion-color-wiki-gold`); brand/UI tone guidance is in `DESIGN.md` and `PRODUCT.md`.
- **Node/npm versions**: enforced via `engines` in each `package.json` and consumed by the Gradle node plugin (`npmInstallCommand = "ci"`). Keep versions aligned across root/frontend/backend when bumping.
- **Docs**: grouped by concept under `docs/` — `domain/` (game rules and entities), `architecture/` (code seams and layering), `development/` (working on the code), `deployment/` (shipping), `adr/` (numbered decisions), `agents/` (machine-read metadata; **fixed paths, never move**). Start from `docs/README.md`. Filenames are **lowercase kebab-case** (ADRs: `NNNN-kebab-title.md`); every doc carries `title`/`type`/`tags`/`related` frontmatter and cross-links with relative markdown links. State a domain rule **once** in `domain/` and link to it — a doc that is both rule and implementation gets split in two and cross-linked.

## Local development setup

Two gitignored env files are required (see `docs/development/local-dev-setup.md` for full details):

- `backend/.dev.vars`: `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `FRONTEND_URL=localhost:5173`
- `frontend/.env.local`: `VITE_BACKEND_URL=http://127.0.0.1:8787`, `VITE_MOCK=true`

With `VITE_MOCK=true`, MSW intercepts all `/api/*` calls except `/api/session` and `/auth/*`, which pass through to the real local backend (Wrangler on `127.0.0.1:8787`).

## Deployment

Branch-based deploys to Cloudflare (see `docs/deployment/deploy-strategy.md`):

- `master` → production Worker `backend`, Pages project `frontend`, D1 `db`
- `dev` → QA Worker `backend-preview`, Pages `frontend` (dev branch), D1 `db-preview`
- `feature/*` and `renovate/*` → CI only (`./gradlew check`), no deploy

The `dispatcher.yml` workflow routes to `build.yml` (CI, all branches) and `deploy.yml` (deploy on `master`/`dev`).
