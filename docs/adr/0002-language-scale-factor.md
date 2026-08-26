---
title: "ADR 0002: Language Scale Factor"
type: adr
tags: [scoring, language, decision]
---

# Per-language calibration via a single Language Scale Factor

> **Update (2026-07-07):** extends this ADR from the original en/it pair to arbitrary
> Wikipedia domains — pins the exact calibration formula and a domain-acceptance floor,
> both left as open items in `docs/domain/scoring-system.md` §9 until now.
>
> **Update (2026-08-09):** `model/pricing.ts` now carries the **measured** `it = 13.9`
> from the snapshot below, replacing the `1.0` placeholder that had been contradicting
> this ADR in code. Every Italian article under 2,000 views/day had been scoring a flat
> zero as a result; the floor is now 144 views/day. Pinned by
> `backend/src/tests/languageScale.spec.ts`, which had no predecessor — the placeholder
> survived because nothing asserted it.
>
> **Update (2026-08-17):** the **calibration pipeline is built** (#532). The hand-maintained
> table is gone: measured factors live in the `language_scales` registry (seeded with the
> `en`/`it` values below), a league freezes its own factor in `leagues.languageScale`, and
> `LanguageScaleCalibrationService` measures a never-played edition — floor check included —
> *before* the league row is written. Three things this ADR got wrong or left open, all now
> settled by measurement (see [Wikipedia Language Editions](../domain/language-editions.md)):
>
> 1. **Calibration is synchronous.** Aggregating 30 daily `/top` lists costs ~31 requests
>    per edition, so it runs inside league creation. No Workflow, and no caching of the
>    `en` side either.
> 2. **The floor is counted per day**, not off window means — the two disagree by enough to
>    flip a verdict (`ca`: 231 vs 143 against a threshold of 300), and the per-day basis is
>    the one this ADR's own figures were measured on (`en` 985, reproduced at 986).
> 3. **Total pageviews cannot stand in for the floor.** `ca` serves 617k views/day and fails
>    where `bn` passes at 296k, so no aggregate threshold separates the two sets.
>
> Also worth knowing: `it` re-measures at **≈11.5** as of 2026-08-15, ~17% below the 13.9
> recorded here six weeks earlier. The seeded value was deliberately *not* changed — see the
> frozen-before-first-price invariant below.

Competition is always same-language (a League has one language), so this is **not** a cross-league comparison device. Different Wikipedias have very different view volumes — real rank-matched data (2026-07-06 snapshot) measures **en.wp ≈ 13.9× it.wp**, not the ≈10× originally assumed — which both ruins tier granularity (Italian articles bunch into one bucket, several drop to 0 credits below rank ~200) and unbalances the flat synergy points (trivial vs dominant) if one universal scoring model is applied to raw views. We multiply each article's raw pageviews by a per-language **Language Scale Factor** before scoring, lifting every language onto one common reference scale (en.wp = 1.0), so a single tier model and a single synergy table are tuned once and reused everywhere.

## Considered Options

- **Separate per-language tier + synergy tables:** rejected — N× the calibration work and N× the explainability burden; the place balance bugs creep in.
- **Percentile / quantile normalization:** rejected for now — shape-invariant and more rigorous, but it replaces the legible tier thresholds with opaque percentile cutoffs.
- **Single scale factor on views:** chosen — one number per language fixes both granularity and synergy balance at once; assumes the two Wikipedias share distribution *shape* (reasonable for large-enough ones — see the domain floor below for where that assumption breaks).

## Consequences

- The factor is **static** (not live): a live factor would re-rate locked-price contracts and make scores drift with no player-visible cause, breaking both explainability and contract balance. Concretely, this means calibration must complete and be **frozen before the first price is computed in a domain** — a league cannot go live on a placeholder `L` that gets backfilled later, since that would silently re-rate every contract priced in the interim.

### Calibration formula (locked 2026-07-07)

```
L(domain) = median( en_views[i] / domain_views[i] )   for i = 1..500 (rank-matched)
```

- Views are each domain's **30-day-average** views per rank (not a single day's snapshot) — a single day is measurably noisy: on the 2026-07-06 en snapshot, the top ranks were dominated by that day's football news, which the ADR's original ~10× estimate didn't account for.
- Ranks are **content-article ranks only**: non-article pages (Main Page, Special:, Talk:, etc.) are excluded via each domain's own `siteinfo` namespace list (`action=query&meta=siteinfo&siprop=namespaces`) — not a hardcoded per-language prefix list, since that doesn't generalize past the couple of languages someone remembered to add prefixes for.
- Median (not mean or ratio-of-sums) was chosen for literal alignment with "rank-matched ratio"; real en/it data showed median and mean tracking within ~1–2% of each other at every K tested, so there's no robustness difference between them here — median was picked on principle, not because mean was measurably worse.
- Recalibrated **~annually** — there is no formal season, and the product's main driver is private leagues among friends.

### Domain-acceptance floor (locked 2026-07-07)

A domain is only accepted (league creation allowed) if its top-list has **≥300 ranks with ≥50 daily views** (post-namespace-filtering), counted **within a single day and taken as the median across the window** — not off each title's 30-day mean, which undercounts exactly the borderline editions this floor judges (measured: `ca` scores 231 per-day against 143 by window mean, on either side of the threshold). This is the basis the figures below were measured on. Below that, the "two Wikipedias differ only in scale, not in distribution shape" assumption this ADR is built on stops holding — real data on `la.wikipedia` (Latin) showed only 12 articles clearing 50 views/day at all, with the tail flattening at a 2–4 view noise floor; a computed `L` there would price a 259-views/day article as if it were viral. Domains failing the floor are rejected at league creation with a clear error, not silently calibrated with a noisy/meaningless `L`.

- Sampled against real 2026-07-06 data: `en` (985 qualifying ranks) and `it` (993) clear the floor comfortably; `ka` (Georgian, 102), `eu` (Basque, 28), `gl` (Galician, 21), and `la` (Latin, 12) do not. In practice this floor currently accepts a short list of the largest Wikipedias, not "every domain" literally — that's the honest tradeoff of keeping the shape-similarity assumption intact rather than shipping a formula that's known-wrong on small wikis.

### Calibration architecture (locked 2026-07-07)

`L` is computed and stored per domain, not derived inline per request. League creation on an already-calibrated domain reads the stored value; a never-before-seen domain triggers calibration (siteinfo + 30 daily top lists + median, `en` side cached/reused across calibrations) which must complete and be persisted **before** the league is created — see the invariant above.

Calibration reads 30 daily `/top` lists per edition — ~31 requests, ~61 counting the reference side — so it runs synchronously inside league creation, and an edition that fails the floor is refused there rather than half-created.

**The `en` side is not cached.** A cache was built and removed: it only ever saved anything when two never-played editions were founded within days of each other, and it cost a second table with a staleness rule of its own. One store remains — `language_scales`, the registry that must never be silently recomputed.

A league **copies** its factor rather than reading the registry per query. A join would mean the ~annual recalibration re-rated every contract in every existing league on that edition, which the invariant above forbids; a copy confines a new measurement to leagues founded after it.

## Related

- [Scoring & Economy System](../domain/scoring-system.md)
- [ADR 0001: Base Scoring Model](./0001-base-scoring-model.md)
