# Copilot Instructions

## Build, test, and lint commands

This repo is a Gradle-orchestrated monorepo (`frontend` + `backend`) where each subproject has its own Node scripts.

### Root (orchestrates both services)

```bash
./gradlew check      # root npm_ci + frontend:check + backend:check
./gradlew dev        # frontend devNoMock + backend wrangler dev
./gradlew devMock    # frontend devMock + backend wrangler dev
./gradlew fix        # frontend/backend format+lint fix tasks
```

### Frontend (`cd frontend`)

```bash
npm run dev
npm run build
npm run test-unit
npm run lint
npm run format
npm run formatfix
```

Single test file:

```bash
npx vitest run src/tests/auth/LoginPage.spec.ts
```

### Backend (`cd backend`)

```bash
npm run dev          # wrangler dev
npm run lint
npm run format
npm run cf-typegen
```

The backend currently has no standalone unit-test script in `package.json`; backend checks in Gradle cover audit/format/lint.

## High-level architecture

- Monorepo with shared TypeScript domain artifacts (`dto/`, `model/`) consumed by frontend and backend.
- **Frontend**: Vue 3 + Ionic SPA with Pinia for app/UI state and TanStack Query for remote server state. App bootstrapping in `frontend/src/main.ts` starts MSW first (when `VITE_MOCK` is not `"false"`), then mounts Vue.
- **Backend**: Cloudflare Worker using Hono (`backend/src/index.ts`), not Express. Routes are split by concern (`/auth`, `/api/session`, `/api/leagues`).
- Auth flow is cookie-based JWT:
  - Google OAuth handled by `@hono/oauth-providers/google` in `backend/src/routes/auth.ts`.
  - Backend signs JWT and stores it in `session_token` HTTP-only cookie.
  - `/api/*` routes are protected with Hono JWT middleware that reads that cookie.
  - Frontend calls APIs with `credentials: "include"` (`frontend/src/services/api.ts`) and gets session user info from `/api/session`.
- Deployments target explicit `master` (prod) and `dev` (QA) environments with fixed backend/frontend URLs per environment.

## Key conventions

- **Node/npm versions are enforced from `engines`** and used by Gradle Node plugin with `npm ci`. Keep `package.json` engine versions aligned when changing runtime versions.
- **Import alias**: use `@/` for frontend `src` imports (configured in Vite).
- **Temporal DTO hydration**: backend responses carrying Temporal types must be explicitly deserialized on the frontend (`Temporal.Instant.from`, `Temporal.Duration.from`) in service-layer helpers.
- **Store pattern**: Pinia stores are composition-style (`defineStore("id", () => ...)`), and persistent UI state is manually synced to `localStorage` inside actions.
- **MSW-first bootstrap**: frontend starts mock worker before mounting; tests also run through MSW with `onUnhandledRequest: "error"` in `frontend/src/tests/setup.ts`.
- **Scaffolding**: create new view components with `npm run g:component` (Plop), which generates both `src/views/<Name>.vue` and `src/tests/<Name>.spec.ts`.
- **Theme tokens**: use Ionic CSS vars from `frontend/src/theme/variables.css`; prefer `--ion-color-wiki-gold` for gold accents.
- **Agent/triage metadata**: repository-level issue tracker and triage vocabulary are documented in `docs/agents/` (seeded from `AGENTS.md`).
