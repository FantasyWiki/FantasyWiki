# FantasyWiki — Definitive Scoring & Economy System

This document supersedes the scoring portions of `FantaWiki-Requirements.md` §2, §3, and §6.
It was derived by stress-testing the original design against three principles and
validating every number against real Wikipedia pageview data
(en.wikipedia top-1000, snapshot 2026-06-07).

Rationale for the load-bearing choices lives in:
- ADR 0001 — base scoring model
- ADR 0002 — language scale factor
- ADR 0003 — trading economy with income floor

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
- `L` is derived from a **rank-matched top-K view ratio** between the language and
  the reference, recalibrated ~annually (no formal season).

---

## 3. Base Points (view-driven daily score)

A **rule-based geometric (log-binned) model** with a convex top tail. One sentence
for players:

> **"Every time an article's views double, it earns one more point — starting at
> 1 point for 4,000 views. Above 150,000 views, each extra 50,000 views adds a point."**

```
            ┌ log₂(NormalizedViews / 4000) + 1        if views ≤ 150,000   (floored at 0)
BasePoints =┤
            └ 6.23 + (NormalizedViews − 150,000)/50,000   if views > 150,000  (linear tail)
```

| Doubling rung | Normalized views | Base points |
|---|---|---|
| floor | 4,000 | 1.0 |
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
- *4,000 floor* — sub-snapshot long-tail articles score ~0 on base and live on synergy
  (the niche archetype).

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

A **closed trading economy with an income floor** (ADR 0003). Players build wealth by
trading; a flat stipend guarantees no death spiral; each league resets.

### 6.1 Pricing
```
ContractPrice = Normalized_30dAvg_Views / 1000 × contract_weeks
```
- Priced on the **30-day average**, never daily views — the anti-jackpot guard. A
  1-day spike barely moves the 30-day average, so you cannot buy-at-10k / sell-at-400k
  overnight; trades only pay off on *sustained* multi-week momentum.
- `purchasePrice` is locked at signing; `currentPrice` floats with the live 30-day
  average and is used for resale.

### 6.2 Budget, slots, and the wealth ceiling
- **Starting budget:** 1,000 credits. **Max 11 contracts** (one per formation position;
  overrides §3.1's "10").
- **Wealth ceiling ≈ 2,400 credits** — the cost of fielding the literal top-11 team for
  one week. Beyond it, extra credits buy only longer **tenure** (locking the best
  articles, denying rivals) and cosmetic prestige — never more points/day. The 11-slot
  cap + scarcity of high-view articles is the structural anti-snowball.

### 6.3 Income, sinks, and frictions

| Lever | Value | Role |
|---|---|---|
| Base stipend | **15 credits/day** | income floor + engagement grind; flat ⇒ anti-snowball |
| Transaction fee | **8% of sale proceeds** | churn / spike-arbitrage throttle (sink) |
| Renewal premium | **+10% per consecutive renewal** (resets after dropping ≥1 cycle) | anti-hoard (sink) |
| Minimum hold | **3 days** | blocks daily spike-churn |
| Early sell | `currentPrice × remaining_weeks − fee` | natural loss if the article fell = the deterrent |
| Renewal priority | 24h right-of-first-refusal at expiry, then free-agent pool | no midnight sniping, but no permanent lock |

**Self-balancing properties (validated):**
- Even view-budget allocation beats viral concentration (Jensen): at 1,000 credits a
  spread of "giants" (~60 base) ≥ one elite + filler (~60 base). Pricing, not the
  scoring curve, contains viral.
- The system is always its own counterparty (infinite free agents), so the economy
  closes with as few as 3 players. **Player-to-player offers are deferred post-MVP.**
- Weekly flow for an average mid player: +105 stipend − ~20 sinks = **+85/week**; over an
  ~8-week league, passive players drift 1,000 → ~1,680, skilled traders reach ~2,300,
  unlucky players are floored by the stipend and never broke. Supply roughly doubles
  per league, then resets.

**Live-tuning levers:** ceiling reached too fast → lower stipend / raise fee+renewal;
players stuck broke → raise stipend or add a means-tested floor top-up; spike-churn
appears → raise fee or lengthen minimum hold; giants hoarded → steepen renewal escalation.

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
| Contract pricing | two contradictory formulas (§3.1 vs §6.1) | `Normalized 30dAvg / 1000 × weeks` (§6.1 wins, on normalized smoothed views) |
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
- Exact `L` values per language and the recalibration procedure.
- Contract duration bounds: code buckets in days (`SHORT ≤3`, `MEDIUM ≤7`, `LONG >7`);
  requirements said weeks–24 months. Leaning to the shorter, code-aligned range.
