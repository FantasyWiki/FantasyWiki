# Base scoring: continuous geometric (log) curve with a convex top tail

We replaced the §2.1 three-tier model (1/0.5/0.1 points per 1k views at 5k/20k knees) with a rule-based geometric model: `base = max(0, log₂(NormalizedViews / 2000))` up to a 150k kink, then **linear** at `+1 point per 50,000 views` above it. (`log₂(views / 2000)` is the same curve as the earlier `log₂(views / 4000) + 1`, with the `+1` folded into the divisor.) **The curve is continuous and returns decimals** — the "+1 per doubling" framing is the headline at the doubling rungs, not an integer step. The `max(0, …)` is a clamp at zero *score*, not integer rounding; it crosses zero at **2,000 views** (one doubling below the 4,000 anchor), so the 2,000–4,000 band still earns a fractional 0–1. We chose this because the original knees sat an order of magnitude *below* the real competitive range (validated against the en.wikipedia top-1000 of 2026-06-07: rank ~1000 ≈ 9k views, giants 80–130k, top-3 300–470k), so almost the entire field landed in the flat tail and viral articles dominated.

## Considered Options

- **Three fixed tiers (original §2.1):** rejected — knees (5k/20k) below the competitive floor, so it behaved linearly across the range it was meant to compress.
- **Discrete log-binned tiers (integer step per doubling):** rejected — a step function throws away mid-band resolution (every article in a doubling band scores identically) and makes pricing lumpy.
- **Continuous log, framed as "+1 per doubling":** chosen — the log curve is the textbook treatment of power-law pageview data (Newman 2005) yet stays explainable because it collapses to one sentence at the rungs: *"every doubling of views adds a point."* Players get the simple mental model; the engine keeps full decimal resolution between rungs.

## Consequences

- The **convex linear tail above 150k is deliberate**: it rewards the volatile daily top ~10 (catching a breakout is worth a large swing), at the cost of reintroducing some viral strength that pricing — not the curve — is responsible for containing.
- Concave mid-field + linear price means **even view-budget allocation beats viral concentration** (Jensen), so the curve and the contract price are co-designed and must move together.
- The 2,000 zero point means sub-snapshot long-tail articles (< 2,000 views) score 0 on base and live entirely on synergy — the intended niche archetype. The 2,000–4,000 band earns a continuous fractional 0–1, so a barely-sub-anchor article is not flatly zeroed.
