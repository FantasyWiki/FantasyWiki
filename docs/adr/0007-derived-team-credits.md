---
title: "ADR 0007: Team credits are derived, not stored, and enforced at the write"
type: adr
tags: [economy, contracts, persistence, concurrency, ddd, decision]
related:
  - ./0003-closed-trading-economy.md
  - ./0005-contract-pricing.md
---

# Team credits are derived, not stored, and enforced at the write

> **Status:** decided and implemented (#503). Migration `0006_team_credits_view.sql` introduces the
> `team_credits` view; the four repositories that previously re-derived the balance now read it,
> and so does the guarded purchase `INSERT`.

A team's credit balance is the Team aggregate's core invariant. This ADR records two decisions
about it that look, at first glance, like violations of the layering rules the rest of the codebase
follows — and why both are deliberate.

## Decision

1. **Credits are derived from the contracts ledger on every read, never stored.**

   ```
   credits = STARTING_CREDITS − Σ purchasePrice + Σ salePayout (where settled)
   ```

2. **The derivation is stated once, as the `team_credits` SQL view.** Every read path joins it.

3. **Affordability is enforced inside the purchase `INSERT`**, not in the service layer — the same
   statement that writes the contract also checks the balance and the contract cap.

4. **`model/team.ts` mirrors the rule as `deriveCredits()`**, a pure function. It does not enforce
   anything; it is the readable, unit-testable statement of what the SQL means.

## Why derived rather than stored

A stored `teams.credits` column is a second copy of a number that the contracts ledger already
determines. Two copies can disagree, and when they do the disagreement is silent and unrecoverable
— there is no way, after the fact, to tell which one is right. Migration `0005_derive_team_credits`
dropped the column for exactly this reason, adding `contracts.salePayout` so the ledger holds every
term of the formula.

The cost is a `GROUP BY` per read. At this scale it does not matter: a team holds at most
`MAX_TEAM_CONTRACTS` (22) contracts, the lookup is an indexed one on `idx_contracts_teamId`, and
FantasyWiki's unit of play is a private league of friends, not a global market.

## Why the check lives in the INSERT — the part that looks wrong

This is the one place where we knowingly trade a DDD principle for a concurrency guarantee. The
principle says an aggregate's invariants belong to the aggregate: the Team should decide whether it
can afford a contract. Our repository decides, in SQL.

The reason is that the obvious alternative is **incorrect**, not merely less tidy. Read the balance
in the service, compare it to the price, then write the contract, and two concurrent buys interleave
like this:

| | Request A | Request B |
|---|---|---|
| 1 | reads credits = 100 | |
| 2 | | reads credits = 100 |
| 3 | 100 ≥ 80 ✓ | |
| 4 | | 100 ≥ 80 ✓ |
| 5 | writes contract (80) | |
| 6 | | writes contract (80) |

Both checks passed against the same stale read; the team has now spent 160 of its 100 credits. The
identical race applies to `MAX_TEAM_CONTRACTS`, which is why that check sits in the same statement:
two concurrent buys at 22 contracts would both see 22 and both commit, giving the team 24.

Cloudflare D1 offers no interactive transaction that would let the service hold a read and a write
together. What it does guarantee is that a **single statement is atomic** against concurrent
writers. So the check and the write have to be one statement, and a statement is SQL. The guarded
`INSERT` is not a shortcut around the domain model — it is the only construct available that makes
the invariant actually hold.

**Do not "fix" this by moving the check into the service layer.** Doing so would reintroduce the
race above, and no unit test would catch it.

## What was actually wrong, and what changed

The enforcement location was never the problem. The problem was that the formula had been
hand-copied into four separate repositories — `contractRepositoryD1` (three sites, including the
`INSERT`), `teamRepositoryD1`, `notificationRepositoryD1`, `performanceRepositoryD1` — as SQL the
domain model could not see. Four copies of a rule is four chances to update three of them.

The `team_credits` view collapses those to one. It is **team-anchored** (`teams LEFT JOIN
contracts`) rather than contract-anchored, so a team with no contracts still appears at the full
starting budget and callers need no `COALESCE` fallback of their own.

The view is used by the guarded `INSERT` too, so the formula now has exactly one SQL statement
across both reads and the write. This is safe on both counts that matter:

- **Atomicity is preserved.** SQLite expands a view at compile time; the `INSERT` is still one
  statement.
- **The query plan is preserved.** `EXPLAIN QUERY PLAN` confirms SQLite pushes the `teamId`
  predicate into the view — `SEARCH t USING COVERING INDEX sqlite_autoindex_teams_1 (id=?)` and
  `SEARCH c USING INDEX idx_contracts_teamId (teamId=?)`. It is still an indexed lookup, not a scan
  of the whole `contracts` table.

## The seam this leaves open

A SQL view takes no bind parameters, so it cannot receive `STARTING_CREDITS` from `model/team.ts` —
the migration inlines `1000` as a literal. That is a genuine duplication, and the honest answer is
that it is pinned by a test rather than by the type system:
`backend/src/tests/repositories/d1/teamCreditsView.d1.test.ts` asserts that a team with an empty
ledger reads back exactly `STARTING_CREDITS`. Change the constant without changing the migration and
that test fails. It sits in the D1 tier because the literal is D1's, and so is the `COALESCE` over a
NULL `salePayout` that the same file pins.

That every read path returns one balance, and that `deriveCredits()` agrees with whatever computes
it, are rules about the *answer* rather than about the view, so they live in
`backend/src/tests/repositories/conformance/derivedCredits.integration.test.ts` — where a second
persistence implementation has to keep them too. That agreement is the whole reason the pure function
exists: the storage enforces, the function documents, and the conformance suite is what keeps them
the same rule.

## Consequences

- `teams` has no `credits` column and must not regain one.
- Any new read path that needs a balance joins `team_credits`. It does not write the formula out.
- Any new rule that must hold across a concurrent write belongs in a guarded single statement, for
  the reason above — not in the service layer.
- A settled contract whose `salePayout` is NULL contributes its purchase and no payout. The view's
  `COALESCE` handles it and a fixture row pins the behaviour.

## Related

- [ADR 0003: Closed Trading Economy](./0003-closed-trading-economy.md) — where `purchasePrice` and
  `salePayout` come from.
- [ADR 0005: Contract Pricing](./0005-contract-pricing.md) — how the amounts are computed.
- `model/team.ts` — `STARTING_CREDITS`, `MAX_TEAM_CONTRACTS`, `deriveCredits`.
