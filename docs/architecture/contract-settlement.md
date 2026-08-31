---
title: Contract Settlement
type: architecture
tags: [contracts, economy, workflow, cron, cloudflare]
---

# Contract settlement

Every night the backend resolves each contract that has reached the end of its
term: it renews it, or it settles it at today's price. This doc is how that is
put together. What each outcome pays, and why, Early Sell proration, the
Expiry Settlement delta, the Renewal Premium, the final-24h window, is stated
once in [Scoring & Economy System](../domain/scoring-system.md) §6.3 and decided
in [ADR 0003](../adr/0003-closed-trading-economy.md). None of it is restated
here.

## Shape of the sweep

```
Cron Trigger (07:00 UTC, every environment)
        │  wrangler.jsonc `triggers.crons`
        ▼
 scheduled() in src/app.ts   ── starts ──►  ContractSettlementWorkflow
        │                                          │
        │  step "fetch-due"  ──► contracts where settled = 0 AND expireDate <= today
        │                                          │
        │  step "settle-<id>" per contract ──► Wikimedia 30-day average
        │                                          └──► renew, or settle at currentPrice
        ▼
 a notification per resolved contract (docs/architecture/notifications.md)
```

The Cron handler is three lines: it starts a Workflow instance with today's date
and returns. Everything else is the Workflow's, and every rule is
`ContractService`'s.

## Why a Workflow and not a loop in the Cron handler

The sweep is a fan-out over network calls that can each fail on their own: one
Wikimedia request per due contract, then a write. In a plain handler, a single
flaky article fails the whole night, and a retry re-does the contracts that
already settled.

A [Cloudflare Workflow](https://developers.cloudflare.com/workflows/) makes each
contract its own durable step. A step that throws is retried with backoff
without re-running its neighbours, and a step that already completed is never
re-run at all. That turns "one article is having a bad night" into a delay for
that article rather than a night with no settlement.

Retrying is only safe because the writes are guarded. `settleExpiry` and `renew`
both match on the contract still being unsettled, and return whether they
changed a row; the service only writes the player's notification when the answer
is yes. A step that is retried after its write landed therefore does nothing and
says nothing, rather than paying a contract out twice.

**A failed views fetch throws rather than settling at zero.** `averageViews30d`
coming back undefined means Wikimedia did not answer, not that nobody read the
article, settling on it would pay a real contract out at 0 credits. The step
throws, the contract stays `settled = 0`, and the next sweep picks it up again.

## The dependency seam

A `WorkflowEntrypoint` is constructed by the runtime, so its dependencies cannot
arrive through a constructor the way every service's do. `createService()` is
the seam instead: a protected factory the tests override to settle against a
stubbed Wikimedia client. It is also why the Workflow class itself holds no
logic worth testing, the rules live in `ContractService.settleDueContract`,
which the integration tier drives directly (a `WorkflowEntrypoint` cannot be
constructed inside the Workers pool at all, see
[Backend Testing](../development/backend-testing.md)).

The Workflow crosses one other boundary: a step's return value is serialized, and
`Temporal.PlainDate` does not survive that. `serialize`/`deserialize` flatten a
`DueContract` to strings between `fetch-due` and each `settle-*`, which is the
only reason those two functions exist.

## What each step decides

One due contract, in order:

1. **No renewal elected** → settle at the full live `currentPrice`, priced at the
   contract's *own* held term (`termDays`), never a fixed tier.
2. **Renewal elected and affordable** → roll the window forward
   (`purchaseDate ← old expireDate`), lock the new `purchasePrice` at
   `currentPrice + premium`, and charge only the incremental cost, because the
   old `purchasePrice` is already sunk in the derived balance
   ([ADR 0007](../adr/0007-derived-team-credits.md)).
3. **Elected but unaffordable** → settle, and say so in the notification. The
   election is not an obligation the player can be held to.

Affordability is judged against `teamCredits` as carried on the due-contract row,
the derived balance at the start of the sweep. The sweep is the only writer of
money at that hour, so a per-contract re-read would answer the same thing.

The league's frozen Language Scale Factor rides on the same row: a contract is
settled at the scale it was bought at, never at whatever the edition measures
today ([ADR 0002](../adr/0002-language-scale-factor.md)).

## Why 07:00, and not 05:00

The two nightly jobs share a row, and the order they run in decides whether a
team keeps its last day of points.

A contract whose `expireDate` is today is due for settlement today *and* still
scorable for yesterday: `getActiveContracts(D)` selects
`settled = 0 AND purchaseDate <= D AND expireDate > D`, and today's expiry
satisfies all three for `D = yesterday`. Settle it first and the article is gone
from `/internal/scoring-inputs` before the collector asks, the team's final
contract-day scores zero, and nothing anywhere reports that it happened.

So settlement runs **two hours after** the collector's 05:00 UTC cron
([nightly scoring pipeline](./scoring-pipeline.md)), wide enough to absorb
GitHub's 10–30 minute scheduling jitter. The gap is the whole ordering
mechanism: there is no lock, no handshake and no retry that would recover the
lost day, so **nothing may move either job without moving the other**. This was
first fixed in the local environments alone (#495) and later applied to every
environment, which is why the two schedules differ by exactly this reasoning and
not by environment.

## Where each piece lives

| concern | code |
| --- | --- |
| the schedule | `backend/wrangler.jsonc`, `triggers.crons` per environment |
| starting the Workflow | `scheduled()` in `backend/src/app.ts` |
| durability, steps, retries | `backend/src/workflows/contractSettlement.ts` |
| what an outcome pays | `model/contract.ts`, pure, and shared with the frontend |
| the decision per contract | `ContractService.settleDueContract` |
| the guarded writes | `ContractRepository.settleExpiry` / `.renew` |
| what the player is told | `writeSettlementNotification` |

## Related

- [Scoring & Economy System](../domain/scoring-system.md) §6.3: what settlement pays
- [ADR 0003: Closed Trading Economy](../adr/0003-closed-trading-economy.md): the decision
- [ADR 0007: Derived Team Credits](../adr/0007-derived-team-credits.md): why only the delta moves
- [Nightly Scoring Pipeline](./scoring-pipeline.md): the job this one has to run after
- [Notifications](./notifications.md): where a settled contract is announced
- [Backend Architecture](./backend-architecture.md): the layering the Workflow stays out of
