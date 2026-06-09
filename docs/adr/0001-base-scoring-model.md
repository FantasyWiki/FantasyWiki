# Base scoring: log-binned tiers with a convex top tail

We replaced the §2.1 three-tier model (1/0.5/0.1 points per 1k views at 5k/20k knees) with a rule-based geometric model: `base = log₂(NormalizedViews / 4000) + 1` (floored at 0) up to a 150k kink, then **linear** at `+1 point per 50,000 views` above it. We chose this because the original knees sat an order of magnitude *below* the real competitive range (validated against the en.wikipedia top-1000 of 2026-06-07: rank ~1000 ≈ 9k views, giants 80–130k, top-3 300–470k), so almost the entire field landed in the flat tail and viral articles dominated.

## Considered Options

- **Three fixed tiers (original §2.1):** rejected — knees (5k/20k) below the competitive floor, so it behaved linearly across the range it was meant to compress.
- **Smooth log / sqrt compression:** rejected — mathematically cleaner for power-law data but not mentally computable by a casual-core audience (explainability is principle #1).
- **Log-binned tiers ("+1 per doubling"):** chosen — log-binning is the textbook treatment of power-law pageview data (Newman 2005), and the doubling rule collapses to one sentence: *"every doubling of views adds a point."*

## Consequences

- The **convex linear tail above 150k is deliberate**: it rewards the volatile daily top ~10 (catching a breakout is worth a large swing), at the cost of reintroducing some viral strength that pricing — not the curve — is responsible for containing.
- Concave mid-field + linear price means **even view-budget allocation beats viral concentration** (Jensen), so the curve and the contract price are co-designed and must move together.
- The 4,000 floor means sub-snapshot long-tail articles score ~0 on base and live entirely on synergy — the intended niche archetype.
