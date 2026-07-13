---
title: Scoring & Economy System
type: domain
tags: [scoring, economy, pricing, contracts]
---

# FantasyWiki — Definitive Scoring & Economy System

This document supersedes the scoring portions of `docs/domain/fantawiki-requirements.md` §2, §3, and §6.
It was derived by stress-testing the original design against three principles and
validating every number against real Wikipedia pageview data
(en.wikipedia top-1000, snapshot 2026-06-07).

Rationale for the load-bearing choices lives in:
- ADR 0001 — base scoring model
- ADR 0002 — language scale factor
- ADR 0003 — closed trading economy (mark-to-market settlement, no income floor, no fee)

---

## 1. Design principles

Every decision below was judged against three principles, in priority order:

1. **Explainability** — a casual-core player can predict their score in their head.
   The audience is 18–45 casual-core; legibility beats mathematical elegance.
2. **Contract balance** — price, points, and budget compose so that no single
   strategy (buy-the-biggest, hoard-one-hub, churn-spikes) is strictly dominant.
3. **Diversity in the META** — high-traffic, mid-traffic+synergy, and niche+event
   strategies are all viable. Validated by team-vs-team simulation, not assertion.

---

## 2. Language normalization

Competition is always same-language, but the *scoring constants* must be calibrated
per language or the model breaks on low-volume Wikipedias (Italian articles bunch
into one score bucket; flat synergy points become dominant). See ADR 0002.

- **Language Scale Factor `L`** — a static per-language constant; reference `L_en = 1.0`,
  lower-volume languages get `L > 1`.
- **Normalized Views** = `raw_pageviews × L`. *All* scoring below operates on
  Normalized Views, never raw views.
- `L(domain) = median(en_views[i] / domain_views[i])` for rank-matched `i = 1..500`,
  using each domain's 30-day-average views (not a single day, which is measurably
  noisy) and content-article ranks only (namespace pages excluded via that domain's
  own `siteinfo`, not a hardcoded prefix list). Recalibrated ~annually (no formal
  season). A domain is only accepted (league creation allowed) if it has **≥300
  ranks with ≥50 daily views** — below that, the shape-similarity assumption behind
  a single scale factor stops holding. Full detail and real-data validation: ADR 0002.

---

## 3. Base Points (view-driven daily score)

A **rule-based geometric (continuous log) model** with a convex top tail. One sentence
for players:

> **"Every time an article's views double, it earns one more point — starting at
> 1 point for 4,000 views. Above 150,000 views, each extra 50,000 views adds a point."**

```
            ┌ max(0,  log₂(NormalizedViews / 2000) )        if views ≤ 150,000
BasePoints =┤
            └ 6.23 + (NormalizedViews − 150,000)/50,000     if views > 150,000  (linear tail)
```

`log₂(views / 2000)` is identical to the earlier `log₂(views / 4000) + 1` form — the
`+1` is folded into halving the divisor. **It is a continuous function and returns
decimals, not integer tiers**: the "+1 per doubling" sentence is only the headline at
the doubling rungs. The `max(0, …)` clamp is a floor *at zero score*, not integer
rounding, and it crosses zero at **2,000 views** (one doubling below the 4,000 anchor),
so the 2,000–4,000 band earns fractional credit (e.g. 2,828 views → 0.5).

| Doubling rung | Normalized views | Base points |
|---|---|---|
| zero | 2,000 | 0.0 |
| (sub-anchor) | 2,828 | 0.5 |
| anchor | 4,000 | 1.0 |
| | 8,000 | 2.0 |
| | 16,000 | 3.0 |
| | 32,000 | 4.0 |
| | 64,000 | 5.0 |
| | 128,000 | 6.0 |
| **kink** | 150,000 | 6.23 |
| tail | 300,000 | 9.23 |
| tail | 476,000 | 12.75 |

**Validated against real en.wp data (2026-06-07):** rank ~1000 (9k views) → 2.24,
giants (80–130k) → 4.3–5.0, top-3 (243–476k) → 8.1–12.8. Top-to-bottom spread ≈ 5.7×.

**Why this shape:**
- *Concave mid-field* — diminishing returns so virality doesn't run away; log-binning
  is the standard treatment of power-law pageview data.
- *Convex tail above 150k* — deliberately rewards the **volatile daily top ~10**
  (catching a breakout is a large point swing). This is the only place viral strength
  is reintroduced; it is contained by **price**, not by the curve (see §6).
- *2,000 zero point* — articles below 2,000 views score 0 on base and live on synergy
  (the niche archetype); the 2,000–4,000 band earns a fractional 0–1 (continuous, not
  a step), so a sub-4k article is not flatly zeroed.

---

## 4. Synergy (additive chemistry)

Chemistry is **additive flat points on the schema-adjacency topology** — *not* a
multiplier and *not* computed over every owned pair. It is evaluated only between
articles placed on positions joined by a **Chemistry Link** in the formation schema
(16–21 links depending on schema; see `dto/enums.ts` `CHEMISTRY_LINKS`).

**Per-link value, summed to a team total:**

| Level | Condition (two placed articles) | Points |
|---|---|---|
| Excellent | mutual Wikipedia link (A→B and B→A) | **+1.5** |
| Good | one-way link (A→B xor B→A) | **+0.5** |
| Weak | both placed, no link | **0** |
| Empty | a slot is unfilled | **0** |

```
TeamSynergy = Σ over schema links ( value(level) )      # mutual = 3 × one-way
```

- Mutual links are worth 3× one-way (preserves the original "reward two-way
  relationships" intent).
- No per-article cap (the ~16–21 link count is the natural ceiling); an optional
  team-level cap ≈ 20 guards degenerate all-mutual builds.
- For per-article display, split each link 50/50 between its two endpoint articles;
  the team total is identical.

**Calibration (E = 1.5).** Simulated against real data at a fixed 1,000-credit budget,
a fully-synergized thematic cluster (which pays a "base tax" because you can't field
11 same-theme giants) draws level with the budget-optimal homogeneous team at
**E ≈ 1.5** — and a cluster that also spends spare budget on 1–2 themed anchors tips
ahead. Below 1.5 synergy is a minor tiebreaker; above it, themes dominate.

---

## 5. Daily and cumulative scoring

```
ArticleScore(day) = BasePoints(NormalizedViews_today)            # §3
TeamScore(day)    = Σ ArticleScore  +  TeamSynergy  +  EventBonus  # §4, §7
Cumulative        = previous cumulative + TeamScore(day)
```

- Scoring uses **today's (daily) Normalized Views** — volatile and exciting.
- Pricing (§6) uses the **30-day average** — smoothed and stable.
  This decoupling is the heart of the meta: a spiking article scores big today but
  costs almost nothing, while a sustained performer is expensive.

---

## 6. Contract economy

A **closed trading economy with mark-to-market settlement** (ADR 0003). Players build wealth by
trading — holding a contract to its full committed term settles as a real gain or loss against
what they paid, not just a spend. There is no flat income floor; a broke player's comeback path is
always-available free (0-credit) articles, not a guaranteed stipend. Each league resets.

### 6.1 Pricing

**Canonical: ADR 0005** (single consolidated ADR — supersedes both the original `/1000 × weeks`
linear formula and an intermediate convex-in-raw-views formula that was tried and replaced after
live data showed it over-concentrated price differentiation at the extreme head of the
distribution):
```
ContractPrice = D × BasePoints(Normalized_30dAvg_Views)^k × contract_days
```
`BasePoints` here is the *exact same curve* as §3 above (log-compressed, same 2000 zero-point and
150k kink), just fed the 30-day average instead of daily views — one curve, one place to tune the
shape. `k` (locked at 1.7) and `D` are pricing-only constants, derived from a full-11-giant-team
budget target rather than from a legacy low-band anchor (see ADR 0005 for why anchoring at the
low end no longer works once price is points-based). Price is convex in *points*, not in raw
views — giants and top-tier articles still cost progressively more per marginal point than
mid-tier articles do, which is what stops a day-one player from affording a top-tier team, but
without the price curve diverging from the value it buys the way a views-based exponent did.

- Priced on the **30-day average**, never daily views — the anti-jackpot guard. A
  1-day spike barely moves the 30-day average, so you cannot buy-at-10k / sell-at-400k
  overnight; trades only pay off on *sustained* multi-week momentum.
- `purchasePrice` is locked at signing; `currentPrice` floats with the live 30-day
  average, evaluated at the contract's tier duration. It's the basis for both exit
  paths — prorated (unused time) for an early sell, or a full-`currentPrice` mark-to-market
  settlement at natural expiry (buy debited `purchasePrice`, so expiry returns stake + P&L;
  §6.3, ADR 0003).
- **Contract duration tiers are locked in days** (ADR 0005): **SHORT = 3 days,
  MEDIUM = 7 days, LONG = 14 days**. These are the actual purchasable durations — the
  `contractDTO.tier` getter derives the *display* tier from an existing contract's
  duration; this is the forward (tier → days) mapping the buy flow uses.

### 6.2 Budget, slots, and the wealth ceiling
- **Starting budget:** 1,000 credits. **Max 11 contracts** (one per formation position;
  overrides §3.1's "10").
- **Wealth ceiling** — previously ~2,400 credits (cost of the top-11 team for one week) under the
  old income-floor economy. **Stale, pending re-derivation (ADR 0003):** under mark-to-market
  settlement, wealth isn't just credits spent so far — it includes unrealized settlement
  gains/losses on every held contract, so the ceiling has to be redefined in terms of position
  value, not spend. Not yet re-derived.

### 6.3 Income, sinks, and frictions

**Canonical: ADR 0003** (single consolidated ADR — supersedes the original income-floor model:
flat stipend, 8% transaction fee, and an expiry with no defined payout are all removed/replaced).

| Lever | Value | Role |
|---|---|---|
| Renewal premium | **+10% per consecutive renewal** (resets after dropping ≥1 cycle) | anti-hoard (sink) |
| Early sell | `currentPrice(liveViews, tierDays) × (remainingDays / tierDays)` credited | pays only for the *unused* time at today's rate — proration is the sole anti-exploit guard (no minimum hold): holding 3 of 14 days recovers only 11/14, so a partial hold can never return the full price |
| Expiry settlement ("sold to system") | credit **`currentPrice(liveViews, tierDays)`** — i.e. `purchasePrice + (currentPrice − purchasePrice)` | full-term mark-to-market: the buy already **debited** `purchasePrice`, so expiry returns the whole stake **plus** the P&L (`currentPrice − purchasePrice`). Net gain if views rose, net loss if they fell. Only reachable by holding the *entire* committed term |
| Renewal decision | owner elects **Renew / let expire** during the **final 24h** of the term; the choice **locks** for expiry (**default = let expire**) | right-of-first-refusal without midnight sniping or a permanent lock; a renewal rolls the window forward (`purchaseDate ← old expireDate`, `expireDate += tierDays`) at `currentPrice + renewal premium` |
| Settlement trigger | daily **Cloudflare Cron** sweep on the backend Worker (~06:00 UTC); 30-day-average views fetched via the Wikimedia client | backend stays the single money-writer (ADR 0004); idempotent on a contract `status` guard |
| Broke-player recovery | free (0-credit) sub-2,000-view articles always available | skill-based comeback (scout undervalued content), not a guaranteed stipend |

**Removed vs. the original model:**
- **Base stipend (was 15 credits/day):** removed — a flat income floor is passive and
  patience-rewarding, at odds with pricing built entirely around active-trading skill (ADR 0005's
  k=1.7). Recovery now comes from the pricing curve's own zero floor instead. Trades a
  *guaranteed* no-death-spiral floor for a *probabilistic* one — an explicitly acknowledged,
  not-yet-fully-mitigated risk (see ADR 0003's "Open risk").
- **Transaction fee (was 8% of sale proceeds):** removed — redundant with the 30-day-average
  smoothing plus early-sell proration, which already do the anti-churn/anti-spike-arbitrage work
  the fee existed for; kept alongside a removed stipend it would've been the one guaranteed drain
  in the economy.
- **Minimum hold (was 3 days):** removed — early-sell proration (`× remaining/tier`) already makes
  a partial hold cost the used portion, so the separate churn block was redundant. With 30-day-
  average pricing a same-day round-trip pays ≈full price back but scores ~0, so churn is
  economically neutral without it.

**Self-balancing properties:**
- Even view-budget allocation beats viral concentration (Jensen): pricing convex in *points*, not
  raw views (ADR 0005) — giants and top-tier articles are progressively less credit-efficient per
  point than mid-tier ones, so spreading budget is always favored over concentrating it.
- The system is always its own counterparty (infinite free agents), so the economy closes with as
  few as 3 players. **Player-to-player offers are deferred post-MVP.**
- **Superseded pending re-simulation (ADR 0003 + ADR 0005):** the day-one optimal team, the
  "~60 base points" / "~42.5 base points" comparisons, and the "+85/week, 1,680 passive / 2,300
  skilled-trader over 8 weeks" flow figures were all calibrated against the old linear-then-
  views-convex pricing *and* the now-removed stipend/fee. None of these numbers are current —
  re-simulate once the mark-to-market economy is implemented.

**Live-tuning levers:** players stuck broke too often → revisit the no-guaranteed-floor
trade-off (ADR 0003's "Open risk"); spike-churn appears → reintroduce a minimum hold or a small
fee (both currently removed); giants hoarded → steepen renewal escalation.

---

## 7. Weekly events — DEFERRED (post-playtest iteration)

**Decision:** events are intentionally held back until the core scoring loop (§3–§6) has
been validated with a test group. Calibrating event bonuses on top of an untested base
would mean tuning two unknowns at once; the base must be confirmed against real player
behavior first.

The four §2.3 events (Momentum Surge, Low Views Protection, Double Synergy, Cluster
Bonus) are **not yet recalibrated** to the new scales and have known issues to resolve
when they are picked back up:

- **Flat bonuses** (+4/+3/+1/+5) were sized against the old base scale and must be
  re-expressed against the new Base Points (top article ≈ 12.8, giant ≈ 5).
- **Double Synergy** now means E 1.5 → 3.0; re-check it does not dominate.
- **Thresholds in raw views** (`<500 views/day`, top-50 global) must move to
  **Normalized Views** to stay language-fair.
- **`hash(user_id + week_number) mod 4`** gives each player a *different* event the
  same week, which contradicts "1 randomized event per week" and hurts explainability —
  decide per-player vs global-per-week.

---

## 8. Summary of changes vs Requirements §2 (v5.4)

| Area | Was (§2 v5.4) | Now |
|---|---|---|
| Synergy mechanic | additive over *all* owned pairs (0.75/0.25, cap 3.0) **and** a position multiplier in the user story (contradictory) | additive flat points on **schema-adjacency**; excellent +1.5 / good +0.5; weak & empty 0 |
| Base scoring | 3 fixed tiers, knees 5k/20k | log-binned "+1 per doubling" from 4k, convex tail above 150k |
| Per-language | none | single **Language Scale Factor** on views (en = 1.0) |
| Contract pricing | two contradictory formulas (§3.1 vs §6.1) | `C × Normalized_30dAvg^1.5 × days` (§6.1, ADR 0005 — convex, days-based, supersedes the earlier linear-weeks form) |
| Economy | implicit/undefined | closed **trading economy** + flat stipend floor + fee/renewal sinks + reset |
| Max contracts | 10 (but formations need 11) | **11** |
| Income | none | 15/day stipend; 8% fee; +10%/renewal; 3-day min hold |

---

## 9. Still open

- Weekly events recalibration (§7).
- Dynamic resale price curve detail (`currentPrice` movement model) and the
  spike-arbitrage edge cases — the broad guard (30-day-avg pricing + fee + min hold)
  is locked; fine balance is a live-tuning item.
- Player-to-player transfer market (offers, time-bounds) — post-MVP.
- ~~Exact `L` values per language and the recalibration procedure~~ — **resolved
  (ADR 0002, 2026-07-07):** median rank-matched top-500 ratio on 30-day-average
  views, domain accepted only above a ≥300-ranks-@-≥50-views floor. Not yet
  implemented in code (`LANGUAGE_SCALE` is still the `{en: 1.0, it: 1.0}`
  placeholder) — still needs the actual per-language `L` computed and code updated
  to account for `L` entering the price formula superlinearly via `BasePoints(rawViews
  × L)^k` (ADR 0005), not as a linear view-volume scale.
- ~~Contract duration bounds~~ — **resolved (ADR 0005):** SHORT = 3 days,
  MEDIUM = 7 days, LONG = 14 days, locked.
- Re-simulate §6.3's economy flow (passive/skilled-trader credit trajectories) under
  the new convex pricing formula — the old linear-formula figures are stale (ADR 0005).

## Related

- [Chemistry Links](./chemistry-links.md)
- [FantaWiki Requirements (Game Design Document v5.5)](./fantawiki-requirements.md)
- [ADR 0001: Base Scoring Model](../adr/0001-base-scoring-model.md)
- [ADR 0002: Language Scale Factor](../adr/0002-language-scale-factor.md)
- [ADR 0003: Closed Trading Economy](../adr/0003-closed-trading-economy.md)
- [ADR 0005: Contract Pricing](../adr/0005-contract-pricing.md)
