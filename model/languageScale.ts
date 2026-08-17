/**
 * The Language Scale Factor, as arithmetic — every rule ADR 0002 locked, and
 * nothing about where the numbers came from.
 *
 * Kept in `model/` rather than in the backend service that fetches the views
 * because the *formula* is a domain rule and the fetching is not: the ranking,
 * the acceptance floor and the rank-matched median are pure functions over
 * numbers, testable without a network or a database, and stated once here the
 * way `scoring.ts` states the scoring curve once. The service above them
 * (`backend/src/services/languageScaleCalibration.ts`) only pulls the daily top
 * lists and persists the answer.
 *
 * @see docs/adr/0002-language-scale-factor.md
 * @see docs/domain/language-editions.md
 */

/**
 * Every other edition is measured *against* `en`, which is 1.0 by definition —
 * not because English Wikipedia is special, but because a common scale needs an
 * origin and this one is the largest edition, so the ratios that lift the others
 * onto it are all ≥ 1 and the scoring curve is tuned once against real numbers
 * rather than an abstract midpoint.
 */
export const REFERENCE_DOMAIN = "en";

export const REFERENCE_SCALE = 1.0;

/**
 * ADR 0002 locked `i = 1..500`. Fewer ranks than a top list carries, and far
 * more than the head: the head is dominated by whatever was in the news on both
 * wikis at once (which is *not* the same story in Italian as in English), and
 * the tail runs into each edition's noise floor. 500 is where the two
 * distributions are both dense and both still about the wiki rather than about
 * the week.
 */
export const CALIBRATION_RANKS = 500;

/**
 * The window each rank's views are averaged over. A single day is measurably
 * noisy — ADR 0002's original ~10x en/it estimate came from one snapshot whose
 * top ranks were that day's football news — so every rank in the comparison is
 * a 30-day mean.
 */
export const CALIBRATION_WINDOW_DAYS = 30;

/**
 * The acceptance floor, locked by ADR 0002: an edition must have at least
 * {@link ACCEPTANCE_MIN_RANKS} content articles averaging at least
 * {@link ACCEPTANCE_MIN_DAILY_VIEWS} views a day.
 *
 * This is the check on the *assumption*, not on the arithmetic — a scale factor
 * is only meaningful if the two editions differ in volume rather than in shape,
 * and below this floor they differ in shape. Real 2026-07-06 data on
 * `la.wikipedia` had 12 articles clearing 50 views/day at all, its tail
 * flattening into a 2–4 view noise floor; a median ratio computed there would
 * price a 259-views/day article as viral. An edition that fails is refused a
 * league rather than calibrated on noise.
 */
export const ACCEPTANCE_MIN_RANKS = 300;

export const ACCEPTANCE_MIN_DAILY_VIEWS = 50;

/**
 * One content article's mean daily views over the calibration window, as the
 * ranking sees it. `title` is carried through the arithmetic only so a
 * calibration can be inspected and argued with — nothing here reads it.
 */
export interface RankedArticleViews {
  title: string;
  averageDailyViews: number;
}

/**
 * A finished calibration: the factor, and enough of its provenance to tell a
 * measured value from a guessed one a year later.
 *
 * `qualifyingRanks` and `sampleSize` are the two numbers that say whether the
 * floor was cleared comfortably or barely, and `referenceDomain` is recorded
 * rather than assumed because a scale means nothing without the thing it is
 * relative to — a future re-anchoring must be able to see which rows predate it.
 */
export interface LanguageScale {
  domain: string;
  scale: number;
  measuredAt: string;
  /** Articles clearing {@link ACCEPTANCE_MIN_DAILY_VIEWS} in the window. */
  qualifyingRanks: number;
  /** Ranks actually compared — {@link CALIBRATION_RANKS}, or fewer for a thin edition. */
  sampleSize: number;
  referenceDomain: string;
}

/**
 * Mean daily views per title over a fixed window, ranked highest first.
 *
 * The divisor is the **window length**, not the number of days a title happened
 * to appear in. A title that dropped out of a day's top list did not go
 * unmeasured that day — it had fewer views than the day's cutoff — so dividing
 * by its appearances would inflate exactly the intermittent titles, and inflate
 * them most on the edition whose list churns fastest. Measured against the
 * expensive per-article route over the same 30-day window, this estimator's
 * median error at the ranks the formula uses is under 1.5% (see
 * docs/domain/language-editions.md).
 *
 * @param viewsByTitle - Summed views per title across the window's daily lists.
 * @param windowDays - Days actually fetched, which may be short of
 *   {@link CALIBRATION_WINDOW_DAYS} if Wikimedia had not published one yet.
 */
export function rankByAverageViews(
  viewsByTitle: ReadonlyMap<string, number>,
  windowDays: number,
): RankedArticleViews[] {
  if (windowDays <= 0) return [];
  return [...viewsByTitle.entries()]
    .map(([title, totalViews]) => ({
      title,
      averageDailyViews: totalViews / windowDays,
    }))
    .sort((a, b) => b.averageDailyViews - a.averageDailyViews);
}

/**
 * How many titles in **one day's** list clear {@link ACCEPTANCE_MIN_DAILY_VIEWS}.
 *
 * Counted per day, and deliberately not off the window means the ratio uses.
 * The two disagree, and only this one is right: a top list is truncated at
 * ~1,000 titles, so a title that fell off it on some days has no view figure
 * for those days, and a 30-day mean that treats them as zero drags exactly the
 * borderline titles below the threshold. That undercount is worst on the
 * editions the floor is meant to judge — measured on `ca` (Catalan), the
 * window-mean basis counts 143 qualifying ranks against 617 on this one, which
 * is the difference between refusing the edition and accepting it.
 *
 * It is also what ADR 0002 actually measured: its `en` figure of 985 came from a
 * single day's top-1000 list, and this basis reproduces it at 986 (2026-08-15,
 * 30-day median). That agreement is why the seeded values stay comparable to
 * anything measured later.
 */
export function countQualifyingRanksForDay(
  dailyViews: readonly number[],
): number {
  return dailyViews.filter((views) => views >= ACCEPTANCE_MIN_DAILY_VIEWS)
    .length;
}

/**
 * The edition's qualifying-rank figure: the **median** of its daily counts.
 *
 * Median rather than mean, for the reason the whole formula averages 30 days
 * rather than trusting one — a single day's list is news-driven, and a day
 * Wikimedia published a short list should not be able to fail an edition on its
 * own.
 */
export function acceptanceQualifyingRanks(
  dailyQualifyingCounts: readonly number[],
): number {
  return Math.round(median(dailyQualifyingCounts));
}

/** Whether an edition is dense enough for a scale factor to mean anything (ADR 0002). */
export function meetsAcceptanceFloor(qualifyingRanks: number): boolean {
  return qualifyingRanks >= ACCEPTANCE_MIN_RANKS;
}

/**
 * A stored factor, made safe to multiply views by.
 *
 * The successor to `resolveLanguageScale`, and deliberately a narrower thing.
 * That function took a *domain* and fell back to 1.0 for any edition missing
 * from a compiled-in table — which made "unmeasured edition" and "English" the
 * same answer, so a league could be played at the wrong scale and nothing would
 * say so. Refusing an uncalibrated edition is now league creation's job
 * (`LanguageScaleCalibrationService`), which leaves only the reason the fallback
 * existed at all: a number arriving from the database must never reach the
 * scoring curve as `NaN`, because `basePoints(NaN)` is `NaN` and it would
 * propagate silently through a whole day's scores.
 *
 * So this guards the *value*, not the edition. A well-formed league never hits
 * the fallback — `leagues.languageScale` is `REAL NOT NULL` — and one that does
 * has a broken row rather than an unmeasured language.
 */
export function normalizeLanguageScale(scale: number | null | undefined): number {
  if (typeof scale !== "number" || !Number.isFinite(scale) || scale <= 0) {
    return REFERENCE_SCALE;
  }
  return scale;
}

/**
 * The middle value, averaging the two middles for an even count.
 *
 * Local rather than imported: it is four lines, and the alternative is a
 * dependency in `model/`, which is deliberately framework-agnostic so both the
 * Worker and the browser can hold it.
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * `L(domain) = median( en_views[i] / domain_views[i] )` for rank-matched
 * `i = 1..500` — ADR 0002's formula, and the one place it is computed.
 *
 * Median rather than mean or ratio-of-sums for literal alignment with
 * "rank-matched ratio"; on real en/it data the three agree within 1–2% at every
 * K tested, so this is a choice made on principle rather than one the data
 * forced.
 *
 * The rank count is **clamped to the shorter of the two lists**. An edition can
 * clear the acceptance floor at 300+ qualifying ranks and still not have 500
 * ranked articles at all, which ADR 0002 does not address; comparing against a
 * missing rank would divide by zero and score every article in that league as
 * viral, so the comparison shortens instead. `sampleSize` records what was
 * actually compared, so a 340-rank calibration is visible as one.
 *
 * Returns `null` when there is nothing to compare or the target's views are not
 * usable — a caller must treat that as "not calibrated", never as 1.0.
 */
export function computeLanguageScale(
  reference: readonly RankedArticleViews[],
  target: readonly RankedArticleViews[],
  maxRanks: number = CALIBRATION_RANKS,
): { scale: number; sampleSize: number } | null {
  const sampleSize = Math.min(maxRanks, reference.length, target.length);
  if (sampleSize === 0) return null;

  const ratios: number[] = [];
  for (let i = 0; i < sampleSize; i += 1) {
    const targetViews = target[i].averageDailyViews;
    // A zero at a rank inside the sample would be a hole in the middle of the
    // distribution, not a small number: skipped rather than propagated as
    // Infinity, which the median would then hand to the scoring path.
    if (targetViews <= 0) continue;
    ratios.push(reference[i].averageDailyViews / targetViews);
  }
  if (ratios.length === 0) return null;

  const scale = median(ratios);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  return { scale, sampleSize };
}
