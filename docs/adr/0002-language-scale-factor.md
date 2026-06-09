# Per-language calibration via a single Language Scale Factor

Competition is always same-language (a League has one language), so this is **not** a cross-league comparison device. Different Wikipedias have very different view volumes (en.wp ≈ 10× it.wp), which both ruins tier granularity (Italian articles bunch into one bucket) and unbalances the flat synergy points (trivial vs dominant) if one universal scoring model is applied to raw views. We multiply each article's raw pageviews by a per-language **Language Scale Factor** before scoring, lifting every language onto one common reference scale (en.wp = 1.0), so a single tier model and a single synergy table are tuned once and reused everywhere.

## Considered Options

- **Separate per-language tier + synergy tables:** rejected — N× the calibration work and N× the explainability burden; the place balance bugs creep in.
- **Percentile / quantile normalization:** rejected for now — shape-invariant and more rigorous, but it replaces the legible tier thresholds with opaque percentile cutoffs.
- **Single scale factor on views:** chosen — one number per language fixes both granularity and synergy balance at once; assumes the two Wikipedias share distribution *shape* (reasonable for two large ones).

## Consequences

- The factor is **static** (not live): a live factor would re-rate locked-price contracts and make scores drift with no player-visible cause, breaking both explainability and contract balance.
- Derived from a **rank-matched top-K view ratio** (not total-domain volume, which conflates per-article popularity with article count), recalibrated **~annually** — there is no formal season, and the product's main driver is private leagues among friends.
