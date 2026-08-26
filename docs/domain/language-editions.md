---
title: Wikipedia Language Editions
type: domain
tags: [language, scoring, calibration, wikimedia]
related:
  - ../adr/0002-language-scale-factor.md
  - ./scoring-system.md
---

# Which Wikipedia editions can host a league, and at what scale

A league is played on exactly one Wikipedia language edition. Two questions follow
from that, and this document answers both with measurements rather than
assumptions:

1. **May an edition host a league at all?** Only if its readership is spread
   thickly enough that a single scale factor is a fair way to compare its
   articles — ADR 0002's *acceptance floor*.
2. **What is that edition's Language Scale Factor?** The number that lifts its raw
   pageviews onto the `en` reference of 1.0, so one scoring curve and one synergy
   table serve every language.

The rules themselves are stated once, in
[ADR 0002](../adr/0002-language-scale-factor.md) (formula, floor, reference) and
implemented in `model/languageScale.ts`. What is here is the evidence: what was
measured, when, and which design choices the numbers forced.

## How the views are gathered, and why the aggregate is trustworthy

`L` needs each edition's 30-day-average views for ranks 1..500. It reads **30
daily `/top` lists and aggregates them per title** — about 31 requests per
edition — because each daily response already carries view counts for up to
1,000 titles. Nothing is fetched per article.

Aggregating a list is not the same measurement as asking for a title's own
30-day series, so it was checked against one. **Over the same window
(2026-07-17 … 2026-08-15), `en` vs `it`:**

| ranks compared | aggregated daily lists | per-title series | difference |
| --- | --- | --- | --- |
| K = 50 | 10.85 | 10.76 | 0.8% |
| K = 100 | 11.00 | 10.96 | 0.4% |
| K = 150 | 11.29 | 11.14 | 1.3% |
| **K = 500** (the locked rank count) | **11.54** | **11.53** | **0.1%** |

They agree to 0.1% at the rank count the formula actually uses, which is what
makes 31 requests inside league creation an honest measurement rather than a
shortcut.

### Why the truncation does not bite

A daily top list stops at ~1,000 titles, so a title that fell off it on some days
contributes nothing for those days. The daily cutoff is not small — a median of
**7,883 views/day** for `en` and **704** for `it` — and only 200 of `en`'s top 500
window-ranked titles appear on all 30 days. So the undercount is real:

| | median aggregated/true mean, top 500 |
| --- | --- |
| `en` | 0.970 |
| `it` | 0.952 |

It cancels. Both sides of the ratio are truncated by the same mechanism, and the
formula is a **ratio at matched ranks**, so a ~3–5% undercount on each side leaves
the median ratio within 0.1%. This is why `rankByAverageViews` divides by the
window length rather than by the days a title appeared in: dividing by appearances
would inflate the intermittent titles, and inflate them *more* on the edition whose
list churns faster — turning a bias that cancels into one that does not.

## The acceptance floor is counted per day, not over the window

ADR 0002 states the floor as "≥300 ranks with ≥50 daily views". There are two ways
to count that, and they disagree sharply:

- **per-day** — on each day, how many titles in that day's list cleared 50 views;
  take the median across the window;
- **window-mean** — rank every title by its 30-day mean, then count those ≥50.

The per-day basis is correct, and is also what the ADR itself measured (its `en`
figure of 985 came from a single day's top-1000 list). Measured 2026-08-15 over 30
days, the per-day basis reproduces it at **986**.

The window-mean basis is wrong for exactly the editions the floor exists to judge,
because that is where truncation bites hardest:

| edition | views/day | per-day count | window-mean count | verdict |
| --- | --- | --- | --- | --- |
| `en` English | 213.7M | 986 | 6066 | pass |
| `it` Italian | 12.2M | 993 | 4788 | pass |
| `da` Danish | 647k | 873 | 555 | pass |
| **`ca` Catalan** | **617k** | **231** | **143** | **fail** |
| `sk` Slovak | 430k | 392 | 307 | pass |
| `bn` Bengali | 296k | 402 | 325 | pass |
| `ka` Georgian | 135k | 89 | 76 | fail |
| `eu` Basque | 111k | 11 | 7 | fail |
| `gl` Galician | 92k | 11 | 7 | fail |
| `la` Latin | 56k | 3 | 3 | fail |

ADR 0002's four sampled failures (`ka`, `eu`, `gl`, `la`) still fail, and its two
passes still pass — the floor has not changed meaning.

### Why the picker is not pre-filtered

The edition picker offers **every** live edition, and the floor is applied at
league creation instead. Pre-filtering the list would mean measuring all ~348
editions on a schedule — a scheduled job, a table of counts, and a staleness rule
— to save a player from choosing one of the few dozen that will be refused
anyway. The refusal is cheap to make good (it names what the edition was short
of) and the machinery is not, so the floor lives in exactly one place: the
calibration that runs when a league is founded.

The measurements below are what a pre-filter would need if the trade ever stops
being worth it. A single day's top-read list is a good enough sample of the same
metric to screen on — one request per edition rather than thirty — and the
verdicts it produces match the 30-day ones everywhere except right at the
boundary (`ca` passes the single-day check on 5 of 29 days and fails the 30-day
median).

### Total pageviews are not a proxy for the floor

`ca` is the case that settles it. Catalan Wikipedia serves **617k views/day, more
than twice Bengali's 296k**, and it fails the floor while Bengali passes
comfortably: its readership is spread so thin that only ~231 articles clear 50
views/day (median daily cutoff: 22 views). Volume is not the test — distribution
*shape* is, which is precisely the assumption ADR 0002's floor exists to check.

So no aggregate-pageview threshold can separate acceptable editions from
unacceptable ones. Among 39 sampled editions the lowest passing edition (`bn`,
296k) sits below the highest failing one (`ca`, 617k), so any single cut-off
misclassifies at least one.

## `L` drifts faster than "recalibrate annually" suggests

ADR 0002 recorded `it = 13.9` from a rank-matched 2026-07-06 snapshot. Re-measured
over the 30 days ending 2026-08-15 — by **both** routes, which agree to 0.1% — it
is **≈11.5**. That is roughly **17% in six weeks**, about 0.4% a day, and it is
drift in the ratio itself rather than a measurement disagreement.

Two consequences, and the first is the one that matters:

- **The stored `13.9` was left alone.** Re-deriving it would re-rate every contract
  already priced in Italian, which is exactly what ADR 0002 forbids. Migration 0009
  seeds the measured values as they were recorded.
- A frozen factor is a *common* scale within one league: a few percent of error
  applies uniformly to every article and every player in it, changing no ranking, no
  relative price and no affordability threshold. Absolute accuracy matters much less
  than consistency within a league.

Whether ~annual recalibration is the right cadence given this drift is worth
revisiting; re-rating live contracts is the reason it is rare, and that reason has
not changed.

## Where each piece lives

| concern | code |
| --- | --- |
| formula, floor, constants, the NaN guard | `model/languageScale.ts` |
| measuring an edition, and refusing one | `backend/src/services/languageScaleCalibration.ts` |
| the registry of measured factors | `backend/migrations/0009_language_scales.sql`, `backend/src/repositories/languageScaleRepository.ts` |
| a league's frozen factor | `leagues.languageScale`, `model/league.ts` |
| the list of editions the picker offers | `external-apis/wikimedia/client/listEditions.ts`, `backend/src/services/wikipediaEditions.ts` |
| the namespace list that says what a content article is | `external-apis/wikimedia/client/getSiteNamespaces.ts` |

Calibrating a never-played edition costs ~61 Wikimedia requests: its own 30-day
window and the reference's. The reference series is deliberately **not** cached
between calibrations, though ADR 0002 suggests it — a cache only pays off when two
new editions are founded within days of each other, which is not how a game of
private leagues among friends is used, and it costs a second table with its own
staleness rule.

Every figure above is reproducible from the two Wikimedia endpoints named in ADR
0002; the window is stated with each measurement because none of them are stable
across months.

## Related

- [ADR 0002: Language Scale Factor](../adr/0002-language-scale-factor.md) — the rules
- [Scoring & Economy System](./scoring-system.md) §2 — where `L` enters scoring
- [ADR 0005: Contract Pricing](../adr/0005-contract-pricing.md) — `L` enters price superlinearly
