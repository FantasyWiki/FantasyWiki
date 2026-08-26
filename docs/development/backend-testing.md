---
title: Backend Testing
type: development
tags: [testing, conventions, repositories, d1]
related:
  - "[[backend-architecture]]"
  - "[[0007-derived-team-credits]]"
---

## Backend Testing

Every backend test runs in the Workers pool, against a real D1 database. What separates the tiers
is not how much of the stack they exercise — it is **which layer they are allowed to name**.

The rule, and the reason for all of it: the persistence target must be replaceable. A second
implementation of the repository interfaces should be able to run this suite unchanged and have it
mean the same thing. So a test may name D1 only where D1 is the subject.

### The tiers

| Where | What it may name | What it is for |
|---|---|---|
| `src/tests/**/*.spec.ts` | interfaces, hand-written fakes | Unit tests. No database at all. |
| `src/tests/integration/` | services, `Repositories` | The rules a caller sees, driven through the service layer. |
| `src/tests/routes/` | routers, `Repositories` | The HTTP shell: statuses, payload shapes, what never leaves. |
| `src/tests/repositories/conformance/` | `Repositories`, nothing below | What a repository owes its callers. **The quality gate a second implementation must pass.** |
| `src/tests/repositories/d1/` | `*RepositoryD1`, SQL, `env.db` | Facts that are true of D1 and would not be asked of another target. |
| `src/tests/support/` | `Repositories` (and D1, under `support/d1/`) | The seam and the fixtures. |

`no-restricted-imports` in `backend/eslint.config.ts` enforces the middle rows: nothing under
`src/services`, `src/routes` or `src/tests` may import `repositories/d1/**`, with
`tests/repositories/d1` and `tests/support/d1` exempt because naming D1 is their purpose.
`composition.ts` is the only module in the codebase that chooses an implementation.

### The seam

`src/tests/support/target.ts` is the one test module that names a persistence target:

```ts
export const repositories = (): Repositories => repositoriesFor(env);
export const store = (): TestStore => new D1TestStore(env.db, env.TEST_MIGRATIONS);
```

Everything above it takes `Repositories` and `TestStore`, so pointing the suite at a second
implementation is a change to this file alone.

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

## Related

- [Backend Architecture](../architecture/backend-architecture.md)
- [OpenAPI Spec](../agents/openapi-spec.md)
- [ADR 0007: Derived Team Credits](../adr/0007-derived-team-credits.md)
