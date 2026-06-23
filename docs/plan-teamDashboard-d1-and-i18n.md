# Plan: Make the Team Dashboard render against local D1 + add an i18n CI check

## Context

Until now the app has only ever run against MSW mocks (`VITE_MOCK=true`). We've
since added a Cloudflare D1 database with a layered backend (routes → services →
repositories), but the league sub-routes the dashboard depends on are still
`501 Not implemented` stubs. The goal is to make **`TeamDashboard.vue` render in
real-DB dev mode** (`./gradlew dev`, i.e. `devNoMock`) by implementing the
endpoints it actually calls, and to populate enough data so the page is
meaningful (your team + a league leaderboard + a performances series).

A second, independent task: add a CI check that flags incomplete / unused i18n
translations, wired into the existing PR check (`./gradlew check`).

Decisions already taken (from clarifying questions):
- **Keep client-side aggregation.** No new `/dashboard` aggregate endpoint — the
  frontend already fans out 4 parallel calls in `dashboardApi.getDashboardData`
  (`frontend/src/services/api.ts`). We implement those individual endpoints.
- **Full data now, except articles.** Implement team, league-with-teams, and a
  new **performances** table. Leave **contracts** and **notifications** as valid
  **empty arrays** for now — both DTOs nest a full `ArticleDTO`, and the team has
  not yet decided how to identify Wikipedia articles (Wikipedia has no stable
  id-based API). Empty slices unblock rendering without locking that decision.
- **i18n check via `@intlify/eslint-plugin-vue-i18n`**, folded into the existing
  lint step (no new CI wiring). Because every ready-made vue-i18n linter can only
  read JSON/YAML (not the repo's TS+ESM catalogs — verified: the plugin's loader
  and `vue-i18n-extract` both fail on `en.ts`/`it.ts`), the catalogs are converted
  to JSON, with compile-time completeness preserved via a typed parity assertion.

> **Scope note (execution):** Per the user, only **Workstream B** and the route
> **rename (A1)** are being executed now; the backend/D1 work (A2–A5) is left to
> the user to implement manually. **A1 is already applied** (see below).

### How the dashboard renders (verified)
`useDashboard()` → `dashboardApi.getDashboardData(league)` does a `Promise.all` of
4 calls; if **any** is non-2xx the whole dashboard shows the error state:
1. `GET /api/leagues/:id/team`            → `TeamDTO`
2. `GET /api/leagues/:id/contracts`        → `RawContract[]`
3. `GET /api/leagues/:id/notifications`    → `NotificationDTO[]`
4. `GET /api/leagues/:id/performances?limit=2` → `PerformanceDTO[]`

The leaderboard reads `currentLeague.teams` from the league store, which is
populated only from `GET /api/leagues` (the list). `TeamManagement` reads
`/leagues/:id/lineup`, but its `draftFormation` defaults to an empty 4-3-3 draft
and the dashboard's error gate ignores lineup state — so **a missing `/lineup`
does not block rendering** (it just shows an empty formation). Lineup
persistence and `/articles` are therefore out of scope here.

---

## Workstream A — Dashboard renders against local D1

### A1. Align self-scoped routes to the `my-` convention — ✅ DONE
`docs/api-naming-rules.md` §3 mandates `my-team` / `my-contracts` /
`my-notifications`. The backend stubs already use `my-contracts`/`my-notifications`;
only the frontend + mocks lag. Make all three consistent:

- `frontend/src/services/api.ts` (`leaguesApi`): `getMyTeam` → `/leagues/:id/my-team`,
  `createMyTeam` (POST) → `/leagues/:id/my-team`, `getMyContracts` →
  `/leagues/:id/my-contracts`, `getMyNotifications` → `/leagues/:id/my-notifications`.
- `frontend/src/mocks/handlers.ts`: rename the matching `http.*` handlers.
- Backend `backend/src/routes/leagues.ts`: change `POST /:id/team` → `POST /:id/my-team`
  and the GET stub `/:id/team` → `/:id/my-team`.
- **Leave `/performances` as-is** (`/leagues/:id/performances`). It returns a
  plural collection and its future scope (my-team series vs. league-wide) is
  still open; resolve the team from the JWT internally for now.
- `teamsApi.*` (`/teams/:id/...`) and `playerApi.*` are not used by the dashboard
  — leave them untouched.

### A2. Backend: league with teams (leaderboard + rank)
The leaderboard/rank/`totalPlayers` need `LeagueDTO.teams` populated.

- Add `getTeamsByLeagueId(leagueId): Result<Team[]>` to `TeamRepository`
  (`backend/src/repositories/teamRepository.ts`) + D1 impl
  (`backend/src/repositories/d1/teamRepositoryD1.ts`) — join `players` for
  `player.name`. Derive `points` from the performances table (sum or latest day,
  see A4); default `0` when none.
- Extend the mapper in `backend/src/services/leagues.ts` (`toLeagueDTO`) to accept
  an optional `teams: TeamDTO[]` arg, or add a `toLeagueDTOWithTeams(league, teams)`.
- Populate teams in `GET /api/leagues` (list) so the store's `currentLeague.teams`
  is non-empty. Also add the currently-missing **`GET /api/leagues/:id`** route
  (frontend `leaguesApi.getById` exists for it) returning the league with teams.

### A3. Backend: implement the four dashboard reads
In `backend/src/routes/leagues.ts`, replacing the `501` stubs. Follow the existing
route pattern (resolve player from `jwtPayload.sub` via `PlayerService`, call a
service returning `Result`, map `.ok`):

- **`GET /:id/my-team`** — `TeamService.getMyTeam(playerId, leagueId)` →
  `teamRepository.getByPlayerAndLeague`. Return `TeamDTO` (200) or `404`.
  (New repo method; mirror `existsByNameInLeague` SQL style.)
- **`GET /:id/my-contracts`** — return `[]` (200) for now. Add a one-line comment
  citing the open Wikipedia-article-identity decision so it's clearly intentional.
- **`GET /:id/my-notifications`** — return `[]` (200) for now, same rationale
  (`NotificationDTO` nests `contract → article`).
- **`GET /:id/performances?limit=N`** — new `PerformanceService` +
  `PerformanceRepository`/D1 impl querying the new table (A4), ordered by `date`
  DESC, `LIMIT N`, scoped to the current player's team in the league. Map to
  `PerformanceDTO` returning `{ teamId, date, points }` for now; the stored
  `formation` JSON is persisted (final table, A4) and resolved into a full
  `FormationDTO` once the article-identity decision lands — no schema change.

### A4. Database: performances table + dev seed
- **New migration `backend/migrations/0003_create_performances.sql`** — design the
  **final** table now (no follow-up migration): `performances(id TEXT PK,
  teamId TEXT NOT NULL FK→teams ON DELETE CASCADE, date TEXT NOT NULL,
  points REAL NOT NULL, formation TEXT NOT NULL, created_at TEXT DEFAULT
  CURRENT_TIMESTAMP)` + index on `(teamId, date)`. `formation` holds a JSON
  snapshot of the lineup that scored those points (schema + positions→contractId
  + chemistry) — a performance is conceptually a daily lineup snapshot, so it
  belongs here from the start. Auto-applied locally by the existing
  `npm_run_db_init_local` gradle dependency before `npm run dev`.
  - Note: the *table* is final, but the **endpoint** still returns
    `{ teamId, date, points }` for now — fully resolving `formation` into a
    `FormationDTO` (positions → `ContractDTO` → `ArticleDTO`) is gated on the same
    open Wikipedia-article-identity decision. When that lands, the resolver reads
    the existing `formation` JSON with **no schema change**.
- **`team.points` derivation**: in `getTeamsByLeagueId`, left-join a points
  aggregate from `performances` (sum, or most-recent day) so the leaderboard is
  ordered meaningfully; `0` when a team has no performances.
- **Local-only dev seed** so the leaderboard isn't a single row. Add
  `backend/seeds/dev_seed.sql` (a few demo players + demo teams in the `global`
  league + a handful of `performances` rows) and a `db:seed:local` npm script
  (`wrangler d1 execute db --local --env local --file=./seeds/dev_seed.sql`),
  wired into the backend `dev` gradle task **after** migrations. Keep it out of
  `db:migrate:remote` so production stays clean. The real logged-in user's own
  team is still created through the existing create-team popup (`POST my-team`) —
  their player id only exists after Google login, so it can't be pre-seeded.

### A5. Running it / known non-blockers
- Dashboard renders via **`./gradlew dev`** (devNoMock → MSW off → all `/api`
  hit local D1). `/api/session` + `/auth/*` already target the real backend.
- `/leagues/:id/lineup` will 404 → `TeamManagement` shows an empty formation
  (non-blocking). Optional nicety: a minimal `GET /:id/lineup` returning an empty
  default formation to silence the console error; defer the PUT/persistence.

**Critical files (Workstream A):** `backend/src/routes/leagues.ts`,
`backend/src/services/{team,leagues}.ts` (+ new `performance.ts`),
`backend/src/repositories/teamRepository.ts` & `d1/teamRepositoryD1.ts`
(+ new `performanceRepository.ts` & d1 impl),
`backend/migrations/0003_create_performances.sql`, `backend/seeds/dev_seed.sql`,
`backend/package.json` & `backend/build.gradle.kts` (seed script),
`frontend/src/services/api.ts`, `frontend/src/mocks/handlers.ts`.

---

## Workstream B — i18n check via @intlify on JSON catalogs

Today `frontend/src/i18n/locales/en.ts` is the schema of record and `it.ts` is
typed `const it: MessageSchema = {…}`, so cross-locale completeness is a compile
error. The gap the linter adds: keys **used in code but missing** from a catalog,
and **orphan/unused** keys. `@intlify/eslint-plugin-vue-i18n` is the standard tool
but its loader only reads `.js`/`.json`/`.yaml` (verified in its source) — a `.ts`
catalog loads as empty, so every key falsely reports "missing". Hence: move the
catalogs to JSON and re-create the compile-time guarantee with a typed assertion.

1. **Convert catalogs to JSON.** `en.ts` → `frontend/src/i18n/locales/en.json`,
   `it.ts` → `it.json` (values verbatim — tests assert exact English copy; drop
   the comments). Delete the two `.ts` files.
2. **Preserve compile-time parity.** Add `frontend/src/i18n/locales/schema.ts`:
   ```ts
   import en from "./en.json";
   import it from "./it.json";
   export type MessageSchema = typeof en;
   // it.json must satisfy the English schema — a missing key is a build error.
   const _itParity: MessageSchema = it;
   void _itParity;
   ```
   `resolveJsonModule` is already enabled (`frontend/tsconfig.json`), and
   `MessageSchema` has exactly one current consumer (`it.ts`, which is being
   replaced), so no other imports change.
3. **Point the app at JSON.** In `frontend/src/i18n/index.ts` import `en`/`it`
   from the `.json` files; `messages: { en, it }` is otherwise unchanged.
4. **Wire the linter.** Re-add dev dep `@intlify/eslint-plugin-vue-i18n`. In
   `frontend/eslint.config.ts`, build on `...vueI18n.configs["flat/base"]` (plugin
   + parser wiring only — not `flat/recommended`, which is all `warn` incl. the
   noisy `no-raw-text`) and enable **as error** for `**/*.{vue,ts}`:
   `@intlify/vue-i18n/no-missing-keys`, `@intlify/vue-i18n/no-unused-keys`, with
   `settings['vue-i18n'] = { localeDir: './src/i18n/locales/*.json' }`. Runs inside
   `npm run lint` → `frontend:check` → `./gradlew check` (PR gate); no workflow
   change. (All `t()`/`$t()`/`<i18n-t keypath>` keys in the repo are static —
   verified — so no `ignores` for dynamic keys is needed.)

Note: the typed assertion catches it.json **missing** keys at build time; the
plugin's `no-unused-keys` covers orphans in either locale, and `no-missing-keys`
covers code→catalog gaps.

**Critical files (Workstream B):** `frontend/src/i18n/locales/{en,it}.json` (new),
`frontend/src/i18n/locales/{en,it}.ts` (deleted),
`frontend/src/i18n/locales/schema.ts` (new), `frontend/src/i18n/index.ts`,
`frontend/eslint.config.ts`, `frontend/package.json`.

---

## Verification

**Workstream A**
1. `cd backend && npm run db:init:local && npm run db:seed:local` — migrations
   (incl. `0003`) and the dev seed apply cleanly.
2. `cd backend && npm run test:integration` — add/extend integration tests under
   `backend/src/tests/integration/` for `getMyTeam`, league-with-teams, and the
   performances repo/service (follow `team.integration.test.ts` +
   `d1TestUtils.ts` reset pattern).
3. `./gradlew dev`, log in with Google, select the global league. If you have no
   team, create one via the popup. Confirm: hero shows credits/contracts(0)/rank,
   leaderboard lists the seeded demo teams + yours, "Attention Needed" is the
   empty state, no error card, network tab shows `my-team`/`my-contracts`/
   `my-notifications`/`performances` all 200.
4. `cd frontend && npm run test` — MSW unit tests still pass after the handler
   path renames (esp. `dashboardData.spec.ts`).

**Workstream B**
5. `cd frontend && npm run lint` passes on a clean tree (the plugin now loads the
   JSON catalogs — no false "missing key" flood).
6. `cd frontend && npm run build` (vue-tsc) is green; then delete a key from
   `it.json` and confirm the build **fails** (typed parity). Revert.
7. Reference a non-existent key in a component → `npm run lint` fails
   (`no-missing-keys`); add an unused key to `en.json` → `npm run lint` fails
   (`no-unused-keys`). Revert.
8. `cd frontend && npm run test` still passes (no locale `.ts` import breakage).
9. `./gradlew check` is green end-to-end (the PR gate).
