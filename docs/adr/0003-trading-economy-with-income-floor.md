# Closed trading economy with an income floor (not a salary cap)

The contract economy is a **trading economy with controlled income**, not a fixed salary cap: players build wealth by trading contracts (buy at locked `purchasePrice`, sell at floating `currentPrice`), supported by a flat income floor that makes a death spiral impossible. We chose this over a pure reservation/salary-cap model because the user wants a *grind* — accumulating in-game wealth to become more powerful — while still guaranteeing a broke player can re-field a team and finish the league. Per-league reset bounds the accumulation so late entrants are never permanently disadvantaged.

## The constraint that shaped it

Closed economy + no death spiral + *real* credit losses are mutually exclusive (real losses are a sink with no source → everyone trends broke → needs income → not closed). We keep **closed + no death spiral**, so income is a flat floor and bad trades cost *current price*, never more than the market.

## Locked parameters

- **Starting budget:** 1,000 credits.
- **Pricing:** `Normalized 30-day-average Views / 1000 × weeks` — priced on the *smoothed* average, so daily spikes are cheap but fleeting (the anti-jackpot guard) and sustained popularity is what's expensive.
- **Base stipend:** 15 credits/day (flat → regressive → anti-snowball floor).
- **Transaction fee:** 8% of sale proceeds (churn / spike-arbitrage throttle).
- **Renewal premium:** +10% per consecutive renewal of the same article (anti-hoard sink; resets after dropping it ≥1 cycle).
- **Minimum hold:** 3 days (blocks daily spike-churn).

## Consequences

- **Wealth has a hard power ceiling (~2,400 credits = the top-11 team for one week):** above it, credits buy only longer *tenure* and cosmetic prestige, never more points/day. This — plus the 11-slot cap and the scarcity of high-view articles — is the real anti-snowball, so income needed no aggressive rubber-banding.
- The system is always its own trade counterparty (Wikipedia supplies infinite free agents), so the loop closes with as few as 3 players — essential for private leagues. Player-to-player offers are deferred post-MVP.
