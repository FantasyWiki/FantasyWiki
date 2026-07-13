---
title: "ADR 0003: Closed Trading Economy"
type: adr
tags: [economy, contracts, settlement, decision]
---

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
  at the contract's tier duration (`D × BasePoints(liveViews)^k × tierDays`, where `tierDays =
  expireDate − purchaseDate` for the current window). This is a "replacement cost" number: what
  this exact contract would cost fresh, today.
- **Early sell** (exiting before the committed term ends): payout =
  `currentPrice × (remainingDays / tierDays)`, credited. You're paid only for the *unused* time, at
  today's rate. Proration is the sole guard (there is **no minimum hold**, removed below): holding
  3 of 14 days recovers only 11/14, so a partial hold can never return the full price plus free
  bonus days of points — the exploit a naive full-`currentPrice`-on-any-sell payout would open.
- **Natural term completion, not renewed** (the "sold to system" case): you've already banked
  every day's points across the full committed term. The buy **debited the full `purchasePrice`**,
  so settlement returns the whole stake plus the mark-to-market P&L — i.e. the team is **credited
  `currentPrice(liveViews, tierDays)`**, equivalently `purchasePrice + (currentPrice − purchasePrice)`.
  Views rose over your whole hold → net profit on top of the points already scored; views fell →
  net loss. (Crediting only the `currentPrice − purchasePrice` *delta*, as an earlier draft of this
  ADR did, was a bug: it silently forfeited the stake, so a flat-views hold lost the entire
  `purchasePrice`.) Reachable only by holding the *entire* committed term, so the early-sell
  proration above can't reach it.
- **Settlement runs on a daily Cloudflare Cron sweep** on the backend Worker (~06:00 UTC, after
  the scoring engine has written the day's views): it finds `ACTIVE` contracts past `expireDate`
  with no renewal elected, fetches each article's 30-day-average views via the Wikimedia client,
  computes `currentPrice`, credits/debits, flips the contract to `SETTLED`, and writes the
  notification. Backend stays the single money-writer (ADR 0004); the sweep is idempotent on the
  `status` guard, so a re-run is a no-op.
- **Renewal is elected in the final 24h of the term** (right-of-first-refusal, reworded — no
  midnight sniping, no permanent lock): during the last 24h the owner picks *Renew* or *let
  expire*, and the choice **locks** for expiry (**default = let expire**). A renewal rolls the
  window forward — `purchaseDate ← old expireDate`, `expireDate += tierDays`, `purchasePrice ←
  currentPrice + renewal premium`, `renewalCount++` — so a contract's tier stays derivable from its
  own two dates and no `tierDays` column is needed.
- **No transaction fee.** The original 8% fee (churn/spike-arbitrage throttle) is redundant with
  two guards that already exist: pricing off the 30-day average (a 1-day spike barely moves it)
  and early-sell proration (a partial hold only recovers unused time). Combined with removing the
  income floor (next point), keeping the fee would make it the *only* guaranteed force in the
  economy — a pure drain that guarantees an average or below-average trader slowly bleeds credits
  even if they roughly break even on views. Removed.
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
- **Minimum hold removed** (was 3 days). Early-sell proration already makes a partial hold cost the
  used portion, so the separate churn block was redundant; and with 30-day-average pricing a
  same-day round-trip pays ≈full price back but scores ~0 points, so churn is economically neutral
  without it. (If spike-churn ever appears in playtesting, reintroducing a minimum hold or a small
  fee is the lever — see "Consequences".)

## Why not just pay full currentPrice on every sell (early or at term)?

Considered and rejected: if *any* sell — early or at term — simply paid full `currentPrice` at the
tier duration, buying LONG (14 days), holding only a few days, and selling at flat views would
return a **full refund** (14-day currentPrice ≈ what you paid, if views didn't move), despite only
holding a fraction of the term — free days of points for zero net cost. That makes LONG strictly
dominant over SHORT/MEDIUM. The two-rule split (prorated for early exit, full settlement only on
natural completion) closes this: partial holds only ever recover partial value. This is also why
there is no separate minimum hold — proration, not a time gate, is what makes early exits fair.

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
- `docs/domain/scoring-system.md` §6.2/§6.3 (stipend, fee, wealth ceiling figures) needs updating to match —
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

## Related

- [Scoring & Economy System](../domain/scoring-system.md)
- [ADR 0005: Contract Pricing](./0005-contract-pricing.md)
