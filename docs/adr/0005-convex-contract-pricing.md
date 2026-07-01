# Convex contract pricing: price scales with views^1.5, not linearly, and the multiplier is days, not weeks

We replaced ADR 0003 / §6.1's `ContractPrice = Normalized_30dAvg_Views / 1000 × contract_weeks` with `ContractPrice = C × NormalizedViews^1.5 × contract_days`, where `C` is derived from an anchor point rather than hardcoded. **Duration is now expressed in days** (matching how contracts are actually stored — `purchaseDate`/`expireDate` — and how the SHORT/MEDIUM/LONG tiers are bucketed in code), and **price is now superlinear (convex) in views**, not linear.

## The problem this fixes

The linear formula, combined with the 1,000-credit starting budget and the (until now undefined) fixed tier durations **SHORT = 3 days, MEDIUM = 7 days, LONG = 14 days**, let a day-one player assemble an all-giants (≈100k views) 11-slot team for as little as **471 credits at the SHORT tier** — under half the starting budget, on day one, with zero grinding. Because scoring is cumulative and never resets mid-league (`scoring-system.md` §5), that day-one team is a **permanent** lead no later trade can erase. Linear pricing makes every tier cost exactly the same per day, so the tier structure gave no protection — the leak existed at every tier, not just SHORT (at MEDIUM, 10 of 11 giants already costs exactly 1,000, the entire starting budget).

Requirement (explicit product decision): **1,000 starting credits should buy a full 11-slot team, but only a modest one — mid-tier articles plus at most a couple of giants** — not the top-tier roster. A dedicated, **actively trading** player (buying low, selling high — not merely a passive stipend-saver) should be able to reach a full giants-tier team roughly **3 weeks** into a league.

## Considered Options

- **Keep linear pricing, lower the starting budget:** rejected as the primary lever — it gates day one with a single retuned constant, but giants remain exactly as credit-efficient as everything else, so "build toward an all-giants team" stays the correct, dominant end-game strategy for every player, just delayed. Doesn't address "worth going big, but not an automatic win."
- **Keep linear pricing, add a SHORT-tier premium:** rejected — analysis showed the leak isn't SHORT specifically (MEDIUM already sits at the budget ceiling for an all-giants team), so a SHORT-only premium just shifts the day-one optimal purchase to MEDIUM instead of closing the gap.
- **Convex pricing (`views^k`, k > 1), anchored so cheap/mid-tier prices are unchanged:** chosen. Makes giants/top-tier articles cost progressively more per marginal view than mid-tier ones, so spreading budget across several good articles is *always* more credit-efficient than concentrating it in a few great ones — reinforcing (not just preserving) the "even allocation beats viral concentration" diversity principle from `scoring-system.md` §6.3. Anchoring to the existing rank~1000 (9,000-view) price keeps the niche/long-tail archetype exactly as affordable as before; only the top of the curve moves.

## Calibration: choosing k

Anchor: keep today's rate at the rank~1000 band (9,000 views, 7 days → 9 credits) fixed, and derive `C` from it: `C = anchorPrice / (anchorViews^k × anchorDays)`. At k = 1.5, `C ≈ 1.5058e-6`.

| k | Full 11-giant(~100k) team @ SHORT | Day-1 gated? | Active-trader weeks to full giants team | Passive-saver weeks to same |
|---|---|---|---|---|
| 1.3 | 971 credits | **No** — under the 1,000 budget | n/a (already affordable) | n/a |
| 1.4 | 1,235 credits | Yes | ~1.4 weeks | ~2.8 weeks |
| **1.5** | **1,571 credits** | **Yes** | **~3.3 weeks** | ~6.6 weeks |

k=1.3 fails outright — an all-giants team is still buyable day one. Between 1.4 and 1.5, the "3-week grind" target only means something if it's gated behind *active trading skill*, not mere patience: at k=1.4 a purely passive saver (no trading skill, just holding cheap rotating articles and banking the flat stipend) already reaches the goal in under 3 weeks — patience alone gets there, which doesn't reward grinding. At **k=1.5**, the passive path takes ~6.6 weeks while an active trader reaches it in ~3.3 weeks — a genuine ~2× separation between playing well and just waiting, which is what "grind" is supposed to mean.

**Caveat on the grind-timeline numbers (not as solid as the day-1 result):** the day-1 gating result is exact arithmetic on the pricing curve against the fixed 1,000-credit budget — solid. The active-trader weekly rate is *not* independently derived; it reuses the ~2× active/passive ratio observed in `scoring-system.md` §6.3's old (now-superseded) linear-pricing simulation. Real buy-low/sell-high profit under a `views^1.5` curve is unmodeled — a given view-count swing now produces a *larger* credit swing at the top of the curve than under linear pricing, which could change the achievable trading margin in either direction. Treat "~3 weeks" as calibrated-to-intent, not as validated as the day-one number, pending a real trade-dynamics simulation.

**Caveat on "3 weeks to a full team":** the SHORT-tier full-giants price (1,571) buys **3 days** of holding that team, not indefinite tenure — there is no residual refund at natural contract expiry. *Sustaining* an all-giants team costs its full price every renewal cycle (currently ~2,333–4,667 credits/week at MEDIUM/LONG), which vastly exceeds any stipend-driven income (~85–170/week). So "reaches a full giants team in 3 weeks" describes an affordable **burst** a grinder's bankroll can fund once they've saved up, not a new sustained steady state. The more accurate long-run description is: the *sustainably fieldable* team strengthens by roughly a giant or two over the course of a league, funded by ongoing trading profit — full-roster giants remain a burst/tenure trade-off, not a resting state. This matches the renewal premium's explicit purpose as an anti-hoard sink (ADR 0003).

## Day-1 result (validated, high confidence)

With `k = 1.5` and the 1,000-credit budget, the optimal 11-slot team (maximizing total daily base points subject to budget) is **10 mid-tier articles (~25k views) + 1 giant-band article (~130k views)**, costing 911 credits, for **≈42.5 base points/day** — versus ≈58–60 base points/day achievable under the old linear formula (near-all-giants). A full 11-giant team costs 3,667 credits at MEDIUM and 7,333 at LONG — well out of day-one reach at any tier.

## Consequences

- **Supersedes** ADR 0003's pricing formula (the rest of ADR 0003 — stipend, fee, renewal premium, minimum hold — is unaffected and still canonical) and the specific "~60 base points at 1,000 credits" / "1,680–2,300 credits over 8 weeks" benchmarks in `scoring-system.md` §6.3, which were calibrated against the old linear-weeks formula and need re-simulation under the new curve — they should not be read as current fact until redone.
- **Locks the contract-duration tiers** at SHORT = 3 days, MEDIUM = 7 days, LONG = 14 days (previously only the reverse — days-to-tier — was defined, never the forward tier-to-days mapping the buy flow needs). This closes `scoring-system.md` §9's "contract duration bounds" open item.
- **The Language Scale Factor `L` (ADR 0002) now enters the formula superlinearly**: `(rawViews × L)^1.5`, not `rawViews × L` scaled linearly as under the old formula. Harmless while `L_en = 1.0`, but whoever calibrates `L` for other languages (still open, ADR 0002) must account for the exponent, not just the per-language view-volume ratio.
- **`C` must be derived from the anchor point in code** (`anchorPrice / (anchorViews^k × anchorDays)`), not hardcoded as a magic constant — it is self-documenting and trivially re-derivable if the anchor or `k` are retuned later.
