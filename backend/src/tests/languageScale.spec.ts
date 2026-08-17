import { describe, it, expect } from "vitest";
import {
  ACCEPTANCE_MIN_DAILY_VIEWS,
  ACCEPTANCE_MIN_RANKS,
  CALIBRATION_RANKS,
  REFERENCE_SCALE,
  acceptanceQualifyingRanks,
  computeLanguageScale,
  countQualifyingRanksForDay,
  meetsAcceptanceFloor,
  median,
  normalizeLanguageScale,
  rankByAverageViews,
} from "../../../model/languageScale";
import { articleScore, basePoints } from "../../../model/scoring";

/**
 * The arithmetic ADR 0002 locked, pinned. The factor had no test at all until
 * recently, which is how `it` sat at the `en` reference for a year while the ADR
 * recorded a measured 13.9; these assertions exist so the formula cannot drift
 * silently the way the value once did.
 *
 * The *stored* values (`en = 1.0`, `it = 13.9`) are seed data now rather than
 * source code, so they are pinned where they live — see
 * `languageScaleRepository.integration.test.ts`.
 */
describe("computeLanguageScale", () => {
  const ranked = (views: number[]) =>
    views.map((averageDailyViews, index) => ({
      title: `A${index}`,
      averageDailyViews,
    }));

  it("is the median of the rank-matched ratios, not of the views", () => {
    // Ratios are 10, 20, 30 -> 20. A ratio-of-sums would give 600/40 = 15, and a
    // median over the wrong axis something else again.
    const reference = ranked([100, 200, 300]);
    const target = ranked([10, 10, 10]);

    expect(computeLanguageScale(reference, target)).toEqual({
      scale: 20,
      sampleSize: 3,
    });
  });

  it("gives the reference edition 1.0 when measured against itself", () => {
    const series = ranked([500, 250, 125]);

    expect(computeLanguageScale(series, series)?.scale).toBe(REFERENCE_SCALE);
  });

  it("compares at most CALIBRATION_RANKS ranks", () => {
    const long = ranked(
      Array.from({ length: CALIBRATION_RANKS + 250 }, () => 100),
    );
    const other = ranked(
      Array.from({ length: CALIBRATION_RANKS + 250 }, () => 10),
    );

    expect(computeLanguageScale(long, other)?.sampleSize).toBe(
      CALIBRATION_RANKS,
    );
  });

  it("shortens to the thinner edition rather than dividing by a missing rank", () => {
    // ADR 0002 says i = 1..500 and does not say what to do with an edition that
    // clears the floor without having 500 ranked articles. Comparing against a
    // rank that is not there would divide by zero and price every article in
    // that league as viral, so the comparison shortens and records that it did.
    const reference = ranked(Array.from({ length: 500 }, () => 100));
    const thin = ranked(Array.from({ length: 340 }, () => 25));

    const result = computeLanguageScale(reference, thin);

    expect(result).toEqual({ scale: 4, sampleSize: 340 });
  });

  it("refuses rather than answering for an edition with nothing to compare", () => {
    expect(computeLanguageScale(ranked([100, 50]), [])).toBeNull();
    expect(computeLanguageScale([], ranked([100, 50]))).toBeNull();
    // All-zero views would otherwise produce Infinity and reach the scoring
    // curve as a number.
    expect(computeLanguageScale(ranked([100, 50]), ranked([0, 0]))).toBeNull();
  });
});

describe("rankByAverageViews", () => {
  it("divides by the window, not by the days a title appeared in", () => {
    // The estimator's whole correctness argument. A title seen once in a 30-day
    // window with 300 views averages 10/day, not 300 — it was below the daily
    // cutoff on the other 29 days, which is a small number rather than no data.
    const ranked = rankByAverageViews(new Map([["Once", 300]]), 30);

    expect(ranked[0].averageDailyViews).toBe(10);
  });

  it("orders by mean views, highest first", () => {
    const ranked = rankByAverageViews(
      new Map([
        ["Quiet", 300],
        ["Loud", 3_000],
        ["Middling", 900],
      ]),
      30,
    );

    expect(ranked.map((entry) => entry.title)).toEqual([
      "Loud",
      "Middling",
      "Quiet",
    ]);
  });

  it("has nothing to rank over a zero-day window", () => {
    expect(rankByAverageViews(new Map([["A", 10]]), 0)).toEqual([]);
  });
});

describe("the acceptance floor", () => {
  it("counts a day's qualifying ranks from that day's own views", () => {
    const views = [500, 100, ACCEPTANCE_MIN_DAILY_VIEWS, 49, 3];

    // The threshold is inclusive: exactly 50 views/day qualifies.
    expect(countQualifyingRanksForDay(views)).toBe(3);
  });

  it("takes the median across the window, so one thin day cannot fail an edition", () => {
    // 29 healthy days and one on which Wikimedia published almost nothing.
    const counts = [...Array.from({ length: 29 }, () => 900), 4];

    expect(acceptanceQualifyingRanks(counts)).toBe(900);
    expect(meetsAcceptanceFloor(acceptanceQualifyingRanks(counts))).toBe(true);
  });

  it("accepts at the floor and refuses just below it", () => {
    expect(meetsAcceptanceFloor(ACCEPTANCE_MIN_RANKS)).toBe(true);
    expect(meetsAcceptanceFloor(ACCEPTANCE_MIN_RANKS - 1)).toBe(false);
  });

  it("agrees with the verdicts ADR 0002 recorded against real data", () => {
    // Measured 2026-08-15 over 30 days on the per-day basis, which reproduces
    // the ADR's own single-day figures (`en` 986 against its recorded 985).
    // Editions the ADR sampled as passing and failing must still land the same
    // way, or the floor has quietly changed meaning.
    const measured = {
      en: 986,
      it: 993,
      sk: 392,
      bn: 402,
      ca: 231,
      ka: 89,
      eu: 11,
      gl: 11,
      la: 3,
    };

    expect(meetsAcceptanceFloor(measured.en)).toBe(true);
    expect(meetsAcceptanceFloor(measured.it)).toBe(true);
    expect(meetsAcceptanceFloor(measured.sk)).toBe(true);
    expect(meetsAcceptanceFloor(measured.bn)).toBe(true);
    // Catalan is the interesting one: 617k views a day, more than Bengali, and
    // it still fails — its readership is spread so thin that only ~231 articles
    // clear 50/day. Volume is not the test; distribution shape is.
    expect(meetsAcceptanceFloor(measured.ca)).toBe(false);
    expect(meetsAcceptanceFloor(measured.ka)).toBe(false);
    expect(meetsAcceptanceFloor(measured.eu)).toBe(false);
    expect(meetsAcceptanceFloor(measured.gl)).toBe(false);
    expect(meetsAcceptanceFloor(measured.la)).toBe(false);
  });
});

describe("median", () => {
  it("averages the two middles for an even count", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("does not depend on the input being sorted", () => {
    expect(median([9, 1, 5])).toBe(5);
  });

  it("is NaN for nothing at all, rather than 0", () => {
    // 0 would be a plausible-looking scale factor; NaN is caught by the guards.
    expect(Number.isNaN(median([]))).toBe(true);
  });
});

describe("normalizeLanguageScale", () => {
  it("passes a real measurement through untouched", () => {
    expect(normalizeLanguageScale(13.9)).toBe(13.9);
  });

  it("falls back to the reference for anything unusable", () => {
    // The scoring path must never see NaN: basePoints(NaN) is NaN, and it would
    // propagate through a whole day of scores without a single error.
    for (const broken of [Number.NaN, Infinity, 0, -3, null, undefined]) {
      expect(normalizeLanguageScale(broken)).toBe(REFERENCE_SCALE);
    }
  });
});

describe("the bunching the factor exists to prevent", () => {
  const ITALIAN_SCALE = 13.9;

  it("scores a modest Italian article above zero", () => {
    // The regression in one line. `basePoints` floors at 2,000 raw views, so at
    // L=1.0 every Italian article under that scored a flat zero — ADR 0002's
    // "several drop to 0 credits below rank ~200", live in production.
    const viewsPerDay = 1_000;

    expect(basePoints(viewsPerDay)).toBe(0);
    expect(articleScore(viewsPerDay, ITALIAN_SCALE)).toBeGreaterThan(0);
  });

  it("separates Italian articles that used to share one bucket", () => {
    // Granularity, the factor's other job: three articles an order of magnitude
    // apart in readership must not all score the same.
    const quiet = articleScore(300, ITALIAN_SCALE);
    const middling = articleScore(3_000, ITALIAN_SCALE);
    const busy = articleScore(30_000, ITALIAN_SCALE);

    expect(quiet).toBeLessThan(middling);
    expect(middling).toBeLessThan(busy);
  });
});
