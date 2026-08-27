---
title: Persistence Targets
type: architecture
tags: [backend, repositories, d1, mongodb, layering]
related:
  - "[[backend-architecture]]"
  - "[[backend-testing]]"
  - "[[0007-derived-team-credits]]"
---

# Persistence Targets

The backend runs on **one of two stores**, chosen per deployment: Cloudflare D1
(SQLite) or MongoDB. Nothing above `repositories/` knows which — services and
routes are handed the `Repositories` interfaces, and the same integration suite
runs against either.

## Choosing one

`backend/src/composition.ts` is the only module in the codebase that names an
implementation, and a binding is what it reads:

| Binding | D1 deployment | Mongo deployment |
|---|---|---|
| `PERSISTENCE` | absent | `mongo` |
| `db` | the D1 database | absent |
| `MONGO_URL` | absent | connection string |
| `MONGO_DB` | absent | optional, overrides the database in the URL's path |

`repositoriesFor(env)` is **synchronous**, and has to stay that way: the request
middleware, the settlement Workflow and the test seam all call it without
awaiting. So the Mongo repositories are built around a *target* and open their
connection on the first call that needs one. One client is cached per target per
isolate, since a `MongoClient` owns a connection pool.

**No Cloudflare deployment runs on MongoDB.** Production and preview are D1, and
the Mongo target runs locally. Keeping it that way took more than good
intentions: `composition.ts` names both targets, so the driver is reachable from
the Worker's entry point, and making the import dynamic is not enough — esbuild
follows dynamic imports and inlines them. Measured on the production dry-run,
that shipped 1.5MB of driver (2722 KiB total, 446 KiB gzipped) with a Worker
that can never use it, and the build *failed* without `nodejs_compat`, because
the driver imports `net`, `tls` and `child_process`.

So `wrangler.jsonc` aliases `mongodb` to `repositories/mongo/driverAbsent.ts`,
which brings the production bundle back to 962 KiB / 220 KiB gzipped — 8 KiB
gzipped above the pre-MongoDB baseline, that being the repository code itself,
which is small and unreachable. No compatibility flag is needed anywhere in
`wrangler.jsonc`, so **the D1 deployments are configured exactly as they were**.

Two things make that safe rather than clever:

- `alias` is a top-level wrangler key — it is ignored inside an environment — so
  it covers every wrangler *build*, which is the right scope when no deployment
  runs on MongoDB.
- The Vitest pool resolves modules through Vite, not wrangler's bundler, so it
  is unaffected and `npm run testmongo` exercises the real driver.

The layering rule is mechanical. `no-restricted-imports` in
`backend/eslint.config.ts` forbids **both** `repositories/d1/**` and
`repositories/mongo/**` to services, routes and tests, exempting only
`tests/repositories/<target>` and `tests/support/<target>`.

## Running the Worker on MongoDB

The Mongo driver runs inside workerd — that is how the suite runs it. Two things
make that work, and both live in `vitest.shared.ts`, deliberately rather than in
`wrangler.jsonc`:

- `compatibilityFlags: ["nodejs_compat"]`, passed to Miniflare for the Mongo run
  only. The driver reaches for `node:net`, `node:tls`, `node:crypto` and
  friends. It is not in `wrangler.jsonc` because `env.test` is a mirror of
  `production`, and a compatibility flag — which changes how dependencies
  resolve and what globals exist — is exactly the kind of difference that would
  stop it being one.
- Vite pre-bundles `mongodb` for the test pool. The driver is CommonJS, and the
  Workers Vitest pool cannot serve a `require("node:x")` from inside a CommonJS
  module; `deps.optimizer.ssr` converts it to ESM, with the Node builtins in
  `exclude` so they stay imports the runtime resolves rather than files rolldown
  tries to read from disk.

MongoDB must be a **replica set** — Atlas always is, and locally a single-node
one is a flag. Multi-document transactions need it, and the guarded writes below
are transactions. The test suite starts one of its own, which is what lets
`./gradlew check` run against both targets on any machine
([Backend Testing](../development/backend-testing.md)).

### Running it locally

`alias` has no per-environment form, so it applies to `wrangler dev` on
`wrangler.jsonc` too. That is why the MongoDB run has a config file of its own,
`backend/wrangler.mongo.jsonc` — no alias, `nodejs_compat` on, `PERSISTENCE` and
`MONGO_URL` set, and no D1 binding at all:

```bash
npm run devmongo         # or ./gradlew devMongo, with the frontend beside it
```

A file rather than a fifth environment in `wrangler.jsonc`, for two reasons. It
is not a deployment — nothing on Cloudflare runs on MongoDB — and the file that
deploys should not carry a configuration that can never be deployed. And it
could not be an environment anyway: the alias it needs switched off is
top-level-only.

It binds less than `env.local` does, on purpose: no D1, no settlement Workflow
or cron (started by a daily trigger that does not fire locally), and no `AI` —
Workers AI has no local simulator, so binding it would make wrangler open a
remote proxy session and demand a live Cloudflare token, turning a local-only
run into one that cannot start without an account. It keeps the rate limiters,
which the join and report routes call unconditionally.

## What is stored

Collection names and field names mirror the D1 columns, so `backend/migrations/`
stays readable as the description of what is stored for either target. Ids are
`_id`.

| Collection | Keyed by | Notes |
|---|---|---|
| `google_accounts` | account id | `googleId` unique |
| `players` | player id | `username` and `accountId` unique |
| `leagues` | league id | `invitationCode` unique *when present* (partial index) |
| `teams` | team id | `(playerId, leagueId)` unique — one row per player per league, ever |
| `contracts` | contract id | indexed by `teamId` and by `(settled, expireDate)` |
| `notifications` | notification id | |
| `performances` | `teamId:date` | `(teamId, date)` unique |
| `lineups` | team id | a team has at most one |
| `language_scales` | language code | |

Dates are stored as text in both targets — ISO-8601 instants for leagues,
`YYYY-MM-DD` for contract terms — so a plain comparison is a chronological one.

There is no migration runner. Mongo has no schema to migrate, so a fresh
database needs only the indexes and the baseline the product assumes exists (the
Global League, its `system` admin, and the `en` scale factor — migrations 0002
and 0009). Both live in `repositories/mongo/bootstrap.ts`, both are idempotent,
and they run on the first connection an isolate opens.

## Team credits

Credits are derived from the contracts ledger on every read and never stored
(ADR 0007). D1 states the rule once as the `team_credits` view; Mongo states it
once as `teamCreditsStages` in `repositories/mongo/schema.ts`, attached to the
five reads that need a balance. Both agree with `deriveCredits` in
`model/team.ts`, which is what the conformance suite checks them against.

## Guarded writes, and what replaces single-statement atomicity

Several repository contracts say the conditions are evaluated *inside* the
write: the purchase conditions, the join gate, the departure, the league
closure. D1 gets that from SQLite's single-statement atomicity.

Mongo has multi-document transactions, but they are **snapshot-isolated, not
serializable** — two transactions that merely *read* the same league would both
commit against a snapshot taken before a concurrent close. So every such
transaction also *writes* the document it is guarding against, bumping
`leagues.revision`. That puts the two in each other's write set, so the loser
hits a write conflict and the driver retries it against the state the winner
left.

`revision` doubles as join order. The value a joiner bumps it to becomes its
team's `seq`, which is the seniority `leave` hands a league on by — the same
thing D1 reads `rowid` for.

Single-document guards need none of this and use none of it: settling a sale,
settling an expiry, renewing, electing and closing are one conditional
`updateOne` each, exactly as they are one conditional `UPDATE` in D1.

The one thing D1 gets for free and Mongo spells out is the cascade. Deleting the
last member's league takes its teams, contracts, notifications, performances and
lineups with it; D1 declares that as `ON DELETE CASCADE`, and
`TeamRepositoryMongo.leave` deletes them inside the same transaction.

## Related

- [Backend Architecture](./backend-architecture.md)
- [Backend Testing](../development/backend-testing.md)
- [ADR 0007: Derived Team Credits](../adr/0007-derived-team-credits.md)
- [League Lifecycle](../domain/league-lifecycle.md)
