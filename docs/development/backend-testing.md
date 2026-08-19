---
title: Backend Testing
type: development
tags: [testing, conventions, repositories, d1, mongodb]
related:
  - "[[backend-architecture]]"
  - "[[persistence-targets]]"
  - "[[0007-derived-team-credits]]"
---

## Backend Testing

Every backend test runs in the Workers pool, against a real database. What separates the tiers is
not how much of the stack they exercise — it is **which layer they are allowed to name**.

The rule, and the reason for all of it: the persistence target must be replaceable. A second
implementation of the repository interfaces should be able to run this suite unchanged and have it
mean the same thing. So a test may name D1 only where D1 is the subject.

That second implementation exists — MongoDB, see
[Persistence Targets](../architecture/persistence-targets.md) — so this is no longer a promise the
suite makes about a hypothetical target. Both runs are the same files, and `./gradlew check` runs
both:

```bash
npm run test        # D1
npm run testmongo   # MongoDB, minus the D1 tier
```

### The tiers

| Where | What it may name | What it is for |
|---|---|---|
| `src/tests/**/*.spec.ts` | interfaces, hand-written fakes | Unit tests. No database at all. |
| `src/tests/integration/` | services, `Repositories` | The rules a caller sees, driven through the service layer. |
| `src/tests/routes/` | routers, `Repositories` | The HTTP shell: statuses, payload shapes, what never leaves. |
| `src/tests/repositories/conformance/` | `Repositories`, nothing below | What a repository owes its callers. **The quality gate a second implementation must pass.** |
| `src/tests/repositories/d1/` | `*RepositoryD1`, SQL, `env.db` | Facts that are true of D1 and would not be asked of another target. |
| `src/tests/support/` | `Repositories` (and a target, under `support/<target>/`) | The seam and the fixtures. |

`no-restricted-imports` in `backend/eslint.config.ts` enforces the middle rows: nothing under
`src/services`, `src/routes` or `src/tests` may import `repositories/d1/**` or
`repositories/mongo/**`, with `tests/repositories/<target>` and `tests/support/<target>` exempt
because naming a target is their purpose. `composition.ts` is the only module in the codebase that
chooses an implementation.

The D1 tier is the only target-specific one today. The Mongo run skips it — those tests ask about
an inlined literal in a view, a `NOT NULL` that provokes a rollback, an empty `IN ()` and a driver
that throws, and none of those are questions to put to another store.

### The seam

`src/tests/support/target.ts` is the one test module that names a persistence target:

```ts
export const repositories = (): Repositories => repositoriesFor(env);

export const store = (): TestStore =>
  env.PERSISTENCE === MONGO_PERSISTENCE
    ? new MongoTestStore(mongoTargetFor(env))
    : new D1TestStore(env.db, env.TEST_MIGRATIONS);
```

Everything above it takes `Repositories` and `TestStore`. Which target it is comes from the same
`PERSISTENCE` binding production reads, through the same `repositoriesFor` — so the suite cannot be
pointed at a combination a deployment could not also be.

`TestStore` is the test-only residue — what the repository interfaces cannot express. It has exactly
one method, `reset()`, and it should stay that way: anything a production repository can already do
belongs there instead. `src/tests/setup.ts` calls it before every test.

### Seeding

Through the interfaces, never with SQL, and never with defaults. `src/tests/support/subjects.ts`
holds the helpers:

- `aPlayer()`, `aTeamIn(leagueId)` — subjects whose only relevant property is that they exist and
  are distinct.
- `aLeague(league, foundingTeamName)` — takes `NewLeague` whole and calls
  `createWithFoundingTeam`, so a test says everything the production caller says.
- `anotherLeague()` — a league with nothing distinctive about it, for tests whose only requirement
  is that it is *not* the league under test. It takes no arguments precisely because such a test has
  no requirements to state.
- `creditsOf(team)`, `unique(prefix)`.

Nothing here fills in a name, an edition or a visibility. Those are the things the tests are *about*,
so a helper that defaulted them would decide the fixture on the test's behalf, and a test could pass
or fail on a value it never named. Where a file needs several leagues that vary in the same few ways,
it defines its own local seeder whose parameters are exactly those ways — all required.

Two consequences of going through the production write path:

- **There is no id to choose.** `createWithFoundingTeam` mints one, so a test addresses a league by
  what it gets back, never by a literal.
- **Every league arrives with a founding team.** Counts start at one, and a test whose subject
  creates their own team lets the helper mint a founder rather than naming itself admin.

### Deciding where a test goes

Ask what would have to change for the test to fail.

- A rule about the answer a caller gets → **conformance**, if a repository alone can be asked for
  it; **integration**, if reaching the answer needs a service.
- A fact about D1 — an inlined literal in a view, a `NOT NULL` that provokes a rollback, an empty
  `IN ()`, a driver that throws → **the D1 tier**. State in the file's docstring why another target
  could not be asked the same question.
- A state no production write can produce → **neither**. A test that has to fabricate its subject is
  testing a shape the system cannot reach, and the honest outcome is a follow-up issue about the
  code that guards it (see #537, #538) rather than a test that keeps the state alive.

### Wikimedia

Never the real client. `src/tests/support/wikimedia.ts` has `wikimediaWithAvg`,
`wikimediaWithArticleViews` and `unusedWikimedia()` — the last a proxy that throws on any property
read, so a test that claims not to need the network fails loudly if that stops being true. The client
is injected through the constructor because `vi.mock` silently no-ops under the Workers pool: a
client reached through the module graph would be unmockable and every test would hit Wikimedia for
real.

### The reset

`D1TestStore.reset()` drops the schema and replays the migrations, rather than deleting from a
hand-maintained table list. Two reasons: a migration that adds a table needs no change here, and the
baseline every test starts from is the migrations' own — including the Global League seeded by
`0002_seed_global_league` — so it cannot drift from production's. It costs ~13ms per test, which was
measured rather than assumed.

`MongoTestStore.reset()` empties every collection and re-seeds, rather than dropping the database.
Mongo has no migrations to replay: the indexes and the baseline are `repositories/mongo/bootstrap.ts`,
which a production deployment runs too, so it cannot drift from production's for the same reason.
Dropping the database would take the indexes with it, and the uniqueness they carry is part of what
the suite is judging.

### Running the Mongo suite

`npm run testmongo` needs nothing installed. It starts its own single-node **replica set** —
`mongodb-memory-server-core`, from `vitest.shared.ts` — and `vitest.globalSetup.ts` stops it when the
run ends. A replica set rather than a plain `mongod` because the guarded writes are transactions
([Persistence Targets](../architecture/persistence-targets.md)).

That is why `./gradlew check` can depend on it, and why it does: a check that only passes on
machines where someone remembered to `docker run` first is a check that will quietly stop being run.

The first such run downloads a ~220MB `mongod` into `backend/.cache/mongodb` (gitignored). The
`-core` package is deliberate — the default one downloads it in a `postinstall`, whether or not
anything will use it — and the directory is outside `node_modules` so `npm ci` does not throw it
away.

`MONGO_URL` points the suite at a server you already have, and skips starting one:

```bash
docker run -d --name fw-mongo -p 27017:27017 mongo:8 --replSet rs0 --bind_ip_all
docker exec fw-mongo mongosh --quiet --eval 'rs.initiate()'
MONGO_URL='mongodb://127.0.0.1:27017/fantasywiki_test?directConnection=true' npm run testmongo
```

That is what CI does (`.github/workflows/check.yml`): a container is cheaper on a runner than a
220MB download per build. The consequence is that the self-starting path is only ever exercised
locally.

The Mongo run sets `fileParallelism: false`, because there is one Mongo. The D1 pool hands every
test file its own database, so the suite is written as if each file owned the store — `reset()`
before every test, ids that only have to be unique within a file. Parallel files sharing one server
would have one file's reset wipe another's fixtures mid-test.

## Related

- [Backend Architecture](../architecture/backend-architecture.md)
- [OpenAPI Spec](../agents/openapi-spec.md)
- [Persistence Targets](../architecture/persistence-targets.md)
- [ADR 0007: Derived Team Credits](../adr/0007-derived-team-credits.md)
