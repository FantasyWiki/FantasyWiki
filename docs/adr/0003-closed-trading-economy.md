# Closed trading economy: mark-to-market settlement, no income floor, no transaction fee

> **Status:** decided in design discussion, not yet implemented in code. Backend has no
> renewal/expiry/settlement logic yet (`rawContract.ts` is pure DTO mapping); `team.ts`'s stipend
> logic and any fee logic, if present, need to be removed as part of implementing this ADR.

Like ADR 0005, this is a single consolidated ADR — later revisions are folded in here rather than
left as a chain of separate superseding documents.

## The constraint that shaped it

Closed economy (system is always its own counterparty — no player-to-player market, deferred
post-MVP) + real credit losses must be possible (otherwise nothing is actually at stake) + no
permanent unrecoverable death spiral. The mechanics below are the current answer to reconciling
those three.

## Current model

**Contracts are positions, not consumables.** Buying an article isn't spending credits on a
disposable good — it's allocating capital into a tradeable position that settles later, based on
whether the article's value moved in your favor.

- **`purchasePrice`** — locked at signing, per ADR 0005.
- **`currentPrice`** — the same ADR 0005 formula re-evaluated with **live** 30-day-average views,
  at the contract's **original tier duration** (`D × BasePoints(liveViews)^k × originalTierDays`).
  This is a "replacement cost" number: what this exact contract would cost fresh, today.
- **Early sell** (exiting before the committed term ends): payout =
  `currentPrice × (remainingDays / originalTierDays)`. You're paid only for the *unused* time, at
  today's rate — this is what stops a "buy LONG, sell after the 3-day minimum hold, get a full
  refund plus free bonus days of points" exploit that a naive full-currentPrice payout would open.
- **Natural term completion, not renewed** (the "sold to system" case): you've already banked
  every day's points across the full committed term, so there's nothing left to prorate. Instead
  it's a real mark-to-market settlement: `settlement = currentPrice(liveViews, originalTierDays) −
  purchasePrice`, credited (positive) or debited (negative) against your balance. Views rose over
  your whole hold → real profit on top of the points already scored. Views fell → real loss. This
  can only trigger by holding the *entire* committed term, so the early-sell exploit above can't
  reach it.
- **No transaction fee.** The original 8% fee (churn/spike-arbitrage throttle) is redundant with
  two guards that already exist: pricing off the 30-day average (a 1-day spike barely moves it)
  and the 3-day minimum hold (blocks rapid churn directly). Combined with removing the income
  floor (next point), keeping the fee would make it the *only* guaranteed force in the economy —
  a pure drain that guarantees an average or below-average trader slowly bleeds credits even if
  they roughly break even on views. Removed.
- **No base stipend.** The flat 15/day income floor is a passive, patience-rewarding mechanic that
  sits at odds with this whole redesign's philosophy (grinding should mean trading skill, not just
  waiting — the same reasoning that chose the k=1.7 pricing exponent). Removed. Recovery for a
  broke player instead comes from the pricing curve's own zero floor: articles under 2,000 views
  genuinely price at **0 credits** (ADR 0005), so a broke player can always fill all 11 slots for
  free and speculate on one rising in popularity — a skill-based comeback path (scouting
  undervalued content), not a guaranteed one. See "Open risk" below.
- **Renewal premium retained** (+10% per consecutive renewal, resets after dropping the article
  ≥1 cycle) — this solves a different problem (anti-hoard) than the fee did (anti-churn), so it's
  unaffected by removing the fee.
- **Minimum hold retained** (3 days) — still the direct block on daily spike-churn, now doing more
  of the anti-churn work on its own since the fee is gone.

## Why not just pay full currentPrice on every sell (early or at term)?

Considered and rejected: if *any* sell — early or at term — simply paid `currentPrice` at the
original tier duration, buying LONG (14 days), holding only the 3-day minimum, and selling at flat
views would return a **full refund** (14-day currentPrice ≈ what you paid, if views didn't move),
despite only holding 3 of the 14 days — three days of points for zero net cost. That makes LONG
strictly dominant over SHORT/MEDIUM. The two-rule split (prorated for early exit, full settlement
only on natural completion) closes this: partial holds only ever recover partial value.

## Open risk (acknowledged, not yet mitigated)

Removing the stipend turns "no death spiral is impossible" from a *guaranteed* floor into a
*probabilistic* one — a broke player recovers only if a free pick they made actually rises. A
genuinely unlucky run (every free pick stays flat or falls for the rest of the league) has no
guaranteed recovery under this model. Mitigating factors that exist by construction, not by
explicit design: a broke player can fill all 11 slots with free articles simultaneously
(diversified speculative exposure — 11 independent chances, not one), and synergy points (schema-
adjacency chemistry) score regardless of an article's price or view count, so a fully-broke
player's score never floors at literal zero. Whether this is sufficient, or whether some additional
backstop is warranted, is a live-tuning item — call it out explicitly if playtesting shows players
getting stuck.

## Consequences

- **Supersedes** this ADR's own original income-floor-based model (flat stipend, 8% fee, no
  settlement mechanic — expiry previously had no defined payout at all).
- `scoring-system.md` §6.2/§6.3 (stipend, fee, wealth ceiling figures) needs updating to match —
  not yet done as of this ADR. The **wealth ceiling** concept (~2,400 credits under the old model)
  needs re-deriving under this economy; it's no longer just "cost of the top-11 team for a week"
  once settlement gains/losses are a factor.
- No backend implementation exists yet for renewal, expiry, or settlement — this is purely a
  design decision pending implementation.
- Grind-timeline figures (active-trader vs. passive-saver weeks-to-full-team) inherited from ADR
  0005 are now doubly stale: they assumed both a stipend and a fee that no longer exist. Needs a
  fresh simulation once implemented.
- Player-to-player trading remains deferred post-MVP; the system stays its own sole counterparty
  for both buys and settlements.
