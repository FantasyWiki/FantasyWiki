---
title: "ADR 0005: Contract Pricing"
type: adr
tags: [economy, pricing, decision]
---

# Contract pricing: from linear-in-views, through convex-in-views, to convex-in-points

> **Status:** current formula decided in design discussion, not yet implemented in code.
> `model/pricing.ts` still has the linear-in-views formula as of this writing.

`ContractPrice` has gone through three iterations. This ADR is the single canonical record —
superseding revisions are folded in here rather than left as a chain of separate ADRs, so there's
one place to read the current formula and the reasoning that ruled out the alternatives.

## Current formula

```
BasePoints(v)  = max(0, log2(v / 2000))            if v ≤ 150,000    # scoring-system.md §3
                 6.23 + (v − 150,000)/50,000        if v > 150,000

ContractPrice = D × BasePoints(Normalized_30dAvg_Views)^k × contract_days
```

Priced on the **30-day average**, never daily views (unchanged since the original design — the
anti-jackpot guard: a 1-day spike barely moves the 30-day average, so trades only pay off on
sustained multi-week momentum). `BasePoints` here reuses the scoring curve's *exact* constants
(2000 zero-point, 150k kink, same linear-tail slope) fed the 30-day average instead of daily
views — one curve, one place to tune the shape. `k` and `D` are pricing-only constants, tuned
independently of the scoring curve.

**Locked: `k = 1.7`**, calibrated so an 11-giant team costs 1,800 credits at the SHORT (3-day)
tier ⇒ `D ≈ 2.577`. **Starting budget: 1,000 credits** (see "why not 10,000" below).

| Band (views) | SHORT (3d) | MEDIUM (7d) |
|---|---|---|
| niche, sub-anchor (3,000) | 3.1 | 7.3 |
| rank~1000 (9,000) | 28.9 | 67.3 |
| mid-tier (25,000) | 69.7 | 162.5 |
| giant (130,000) | 163.6 | 381.8 |
| top-3 (300,000) | 338.1 | 788.9 |
| viral/event spike (638,000) | 860.5 | 2,007.9 |

- **9 mid-tier + 2 giants (full 11-slot team) @ SHORT = 954.1** — matches "1,000 credits buys a
  full team with a couple of giants" almost exactly.
- **Full 11-giant team @ SHORT = 1,800** (1.8× the 1,000-credit budget) — gated behind grinding.
- Contract-duration tiers, locked in **days**: SHORT = 3, MEDIUM = 7, LONG = 14.

## How we got here

**v1 — linear (superseded):** `Normalized_30dAvg_Views / 1000 × contract_weeks`. Let a day-one
player assemble an all-giants 11-slot team for as little as 471 credits at SHORT — under half the
starting budget, on day one, zero grinding. Because scoring is cumulative and never resets
mid-league, that's a permanent lead. Rejected: giants were exactly as credit-efficient as
everything else, so "build toward all-giants" stayed the dominant strategy at every tier, just
delayed by budget.

**v2 — convex-in-views (superseded):** `C × NormalizedViews^1.5 × contract_days`, anchored to
preserve the legacy ~9-credit rank~1000 price. Fixed the day-one snowball (giants now cost
progressively more per marginal view than mid-tier articles), but live data on real articles
exposed a new problem: **BasePoints spreads only ~5.7x** across the whole competitive range
(anchor to viral) while **ContractPrice spread 249x** — price diverged 44x faster than the value
it buys. Root cause: pageviews are Zipfian, so any convex function stacked directly on raw views
front-loads nearly all price differentiation onto the extreme head of the distribution (~rank
1–40), leaving rank ~40-down-to-anchor nearly flat. That's what produced "top tier costs way too
much, mid tier way too low, all the way down."

**v3 — convex-in-points (current):** apply the convexity to `BasePoints` (already
log-compressed, ~5.7x spread) instead of to raw views (~249x spread for the same range). This
gives direct control over the top-to-anchor price ratio via `k` alone, without a convex-in-views
formula fighting the underlying power-law skew. Two options were rejected en route:
- **Price = points directly (k=1):** removes the anti-snowball property entirely — credits-per-
  point becomes constant, re-opening the exact all-giants-day-one bug v1 had. Points' own
  anti-snowball (synergy + log-compression) balances *score composition* across archetypes; it
  doesn't gate *affordability* on its own, so price still needs its own convexity knob.
- **Anchoring at the low end (like v2 did):** rejected for v3 — because points only span ~27x
  total, any `k` that also preserves the old low anchor leaves even a full 11-giant team costing
  118–327 credits, nowhere near gating against a 1,000-credit budget. The anchor must be set from
  the *top* (fix the full-11-giant-team price, derive `D` from it) instead.

## Why starting budget is 1,000, not 10,000

v2's `CREDIT_SCALE × 10` / `10,000`-credit budget existed only to fix a rounding artifact: the
`views^1.5` formula's tiny coefficient made many low-view articles round down to 0 integer
credits. Verified this does **not** reproduce under the points-based curve — `BasePoints` already
intentionally floors at 0 for sub-2,000-view articles (the documented niche/synergy archetype), so
near-zero prices there are correct design, not a resolution bug. No hidden internal fixed-point
scale either — credits are integers everywhere already (team balance column, stipend accrual, fee
math); threading a hidden multiplier through all of that for a display-only difference isn't
worth it. Reverts to the simpler, already-established **1,000**, matching the explainability
principle for a casual-core audience.

## Consequences

- `model/pricing.ts`, `docs/domain/scoring-system.md` §6.1, and `CONTEXT.md`'s Contract Price entry all need
  updating to this formula — not yet done as of this ADR.
- The Language Scale Factor `L` (ADR 0002) still enters superlinearly, now as
  `BasePoints(rawViews × L)^k` — same caveat as before: whoever calibrates `L` for other languages
  must account for the exponent, not just the raw view-volume ratio.
- Grind-timeline re-derivation (the "~3 weeks to a full giants team, active trader vs. passive
  saver" narrative) under this curve is still unvalidated — same caveat v2 already carried,
  inherited here too.
- Still open, raised alongside this decision but not yet resolved: the "sold to system if nobody
  renews at contract expiry" payout mechanic, and the trending-spike resale risk (buying near a
  rising 30-day average that may already be about to mean-revert down).

## Related

- [Scoring & Economy System](../domain/scoring-system.md)
- [ADR 0003: Closed Trading Economy](./0003-closed-trading-economy.md)
