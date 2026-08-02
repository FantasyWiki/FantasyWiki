---
title: "ADR 0007: Team Credits Are Derived, Not Stored, and Enforced at the Write"
type: adr
tags: [economy, credits, concurrency, persistence, decision]
---

# Team credits are derived, not stored, and enforced at the write

> **Status:** accepted, implemented. The derivation lives in the `team_credits`
> SQL view (`backend/migrations/0006_team_credits_view.sql`) and is mirrored as
> a pure function in `model/team.ts`.

A team's credit balance is the Team aggregate's core invariant:

```
credits = STARTING_CREDITS − Σ purchasePrice + Σ salePayout (where settled)
```

Two decisions are recorded here, and they pull in opposite directions on
purpose.

## Decision 1 — credits are derived from the contracts ledger, never stored

There is no `teams.credits` column. Migration
`0005_derive_team_credits.sql` dropped it and added `contracts.salePayout` so
that every event that moves a balance — a purchase, an early sale, a settlement
at expiry — is a row in the contracts ledger and nothing else.

A stored balance would be a second source of truth for something the ledger
already fully determines. Any write that updated one without the other, or
crashed between the two, leaves a team richer or poorer than its own contract
history says it should be, permanently and silently. Deriving removes that
failure mode by construction: there is nothing to drift.

The cost is that every read of a balance is an aggregate over that team's
contracts. At the scale this game operates (tens of contracts per team, capped
at `MAX_TEAM_CONTRACTS` active) that is a cheap grouped scan, and it buys an
invariant that cannot be violated by a partial write.

## Decision 2 — the invariant is enforced at the write, in SQL, not in the aggregate

Classic DDD says an aggregate enforces its own invariants: the service loads
the Team, asks it whether it can afford the contract, and persists the result.
We deliberately do **not** do that for credits.

The reason is a race. Read-then-write in the application layer looks like:

1. Request A reads credits = 100, price = 80 → affordable.
2. Request B reads credits = 100, price = 80 → affordable.
3. A writes its contract. B writes its contract.
4. The team has spent 160 of its 100 credits.

Nothing in the application layer prevents step 2, because the check and the
write are two separate round trips to D1 and another request can interleave
between them. The same argument applies to `MAX_TEAM_CONTRACTS`: two concurrent
buys at 21 active contracts both see room and both commit, landing the team on
23.

So the credit check, the contract-count check and the insert are **one
statement** — the guarded `INSERT` in
`ContractRepositoryD1.create`, which inserts only if the conditions still hold
at write time:

```sql
INSERT INTO contracts (...)
SELECT ?, ?, ?, ?, ?, ?, 0, 0, 0
WHERE (SELECT credits FROM team_credits WHERE teamId = ?) >= ?
  AND NOT EXISTS (... article already owned in this league ...)
  AND (SELECT COUNT(*) FROM contracts WHERE teamId = ? AND settled = 0) < ?
```

SQLite (and therefore D1) guarantees single-statement atomicity against
concurrent writers, so the interleaving above cannot happen: the loser inserts
zero rows and the repository returns `PURCHASE_CONFLICT`. The service's
pre-checks upstream still exist — they produce good error messages — but they
are not what makes the invariant hold. This statement is.

Settlement writes are guarded the same way and for the same reason:
`settleSale` and `settleExpiry` flip `settled` and persist the payout in one
`UPDATE` guarded on `settled = 0`, which is what makes a double-sell and a
re-run of the nightly sweep both no-ops.

## Decision 3 — the derivation is written exactly once in SQL

The consequence of decision 2 is that the rule has to be expressed in SQL. The
consequence of decision 1 is that it is needed at every site that reads a
balance. Before this ADR, that meant the formula was hand-copied into four
repositories (`contractRepositoryD1`, `teamRepositoryD1`,
`notificationRepositoryD1`, `performanceRepositoryD1`) — four chances to fix a
bug in three places.

It is now stated once, as the `team_credits` view:

```sql
CREATE VIEW team_credits AS
SELECT t.id AS teamId,
       t.playerId AS playerId,
       t.leagueId AS leagueId,
       1000
         - COALESCE(SUM(c.purchasePrice), 0)
         + COALESCE(SUM(CASE WHEN c.settled = 1 THEN c.salePayout ELSE 0 END), 0) AS credits
FROM teams t
LEFT JOIN contracts c ON c.teamId = t.id
GROUP BY t.id, t.playerId, t.leagueId;
```

Every reader joins the view. The guarded `INSERT` reads it as a scalar
subquery, which changes nothing about its atomicity — a view is inlined into
the referencing statement, so it is still one statement doing the enforcing.

Three shape choices are load-bearing:

- **Driven from `teams`, not from `contracts`.** Grouping over `contracts`
  alone gives no row at all for a team that has never bought anything, which
  forces every caller to re-state the starting budget in a `COALESCE` fallback
  — the duplication we are removing, in a subtler form. Driving from `teams`
  gives every team exactly one row, so a brand-new team reads
  `STARTING_CREDITS` straight out of the view.
- **`playerId` and `leagueId` are exposed and named in the `GROUP BY`, and
  callers filter on them.** A view is not a cache: SQLite has no materialised
  views, so the aggregate is recomputed as part of every statement that
  references it. What decides the cost is therefore whether SQLite can push the
  caller's `WHERE` clause down into the aggregate, and it only does that for
  constraints naming the view's own `GROUP BY` columns. `WHERE tc.leagueId = ?`
  narrows the aggregate to one league; the equivalent `WHERE t.leagueId = ?` on
  a joined `teams` row does not, and builds it for every team in the database
  first. `EXPLAIN QUERY PLAN` is the check: the view's `CO-ROUTINE` block
  should show a `SEARCH` on an index, not a bare `SCAN t`.
- **The starting budget is inlined.** SQLite views cannot take parameters, so
  `1000` appears literally in the view instead of being bound from
  `STARTING_CREDITS`. This is the one piece of duplication the change does not
  eliminate, and it is guarded by an integration test asserting the view's
  value for a contract-less team equals `STARTING_CREDITS`. Drift fails CI
  rather than silently mispricing every balance in the game.

## Decision 4 — the rule is mirrored as a pure function in `model/`

`model/team.ts` exposes `deriveCredits(startingCredits, purchases, payouts)`
and `deriveCreditsFromLedger`. They do **not** run in the purchase path — they
would reintroduce the race if they did. They exist so the aggregate's core
invariant has one readable, testable statement in the domain model instead of
existing only as SQL the model cannot see, and so a reader of `model/team.ts`
learns the rule without opening a migration.

The duplication between the pure function and the view is accepted and
deliberate: it is a specification and its concurrency-safe implementation, kept
honest by tests that assert both produce the same number for the same ledger.

## Consequences

- Reading a balance always costs an aggregate over the team's contracts, on
  every read — nothing is cached. Adding a reader that filters the view on a
  joined table's columns instead of the view's own silently turns a per-team
  aggregate into a whole-database one, so new call sites should be checked with
  `EXPLAIN QUERY PLAN`. If the per-read cost ever shows up in profiling, the
  fix is a materialised summary maintained by triggers — not a hand-maintained
  column, and not moving the check into the service layer.
- The formula lives in a migration, and migrations are immutable history.
  Changing `STARTING_CREDITS` means a new migration redefining the view *and*
  the constant in `model/team.ts`. Note this retroactively restates every
  team's balance either way, since nothing is stored.
- A future migration cannot drop or rename `contracts.purchasePrice`,
  `contracts.salePayout`, `contracts.settled` or `teams.id` without recreating
  the view in the same migration — SQLite validates views on schema change.
- The service layer's affordability pre-checks are now explicitly advisory.
  Removing one degrades an error message, it does not open a hole; changing the
  guarded `INSERT` does open one.

## Related

- [ADR 0003: Closed Trading Economy](./0003-closed-trading-economy.md)
- [ADR 0005: Contract Pricing](./0005-contract-pricing.md)
- [Scoring & Economy System](../domain/scoring-system.md)
- [Backend Architecture](../architecture/backend-architecture.md)
