import { describe, it, expect } from "vitest";
import {
  LANGUAGE_SCALE,
  isCalibratedDomain,
  resolveLanguageScale,
} from "../../../model/pricing";
import { articleScore, basePoints } from "../../../model/scoring";
import type { Domain } from "../../../model/enums";

/**
 * The Language Scale Factor had no test at all, which is how `it` sat at the
 * `en` reference for a year while ADR 0002 recorded a measured 13.9. Every
 * assertion here exists to make that specific drift loud.
 */
describe("LANGUAGE_SCALE", () => {
  it("keeps en as the reference every other edition is measured against", () => {
    expect(LANGUAGE_SCALE.en).toBe(1.0);
    expect(resolveLanguageScale("en")).toBe(1.0);
  });

  it("carries the figure ADR 0002 actually measured for it", () => {
    // Rank-matched 2026-07-06 snapshot: en.wp ≈ 13.9× it.wp. If this number
    // moves, it is because someone recalibrated — which re-rates every contract
    // ever priced in Italian — and not because a placeholder crept back.
    expect(LANGUAGE_SCALE.it).toBe(13.9);
  });

  it("still answers for an edition it has never measured, rather than NaN", () => {
    // The scoring path must never produce NaN from a domain that slipped
    // through. Answering 1.0 is a safety net, *not* permission to play there.
    //
    // Cast because `Domain` is still the `"en" | "it"` union while
    // `leagues.domain` is plain TEXT — an unmeasured edition is exactly the
    // value the type says cannot happen and the database happily stores. The
    // cast goes away when the type opens up.
    const unmeasured = "zzz" as Domain;

    expect(resolveLanguageScale(unmeasured)).toBe(1.0);
    expect(Number.isNaN(resolveLanguageScale(unmeasured))).toBe(false);
  });

  it("does not mistake that fallback for a calibration", () => {
    expect(isCalibratedDomain("en")).toBe(true);
    expect(isCalibratedDomain("it")).toBe(true);
    // Large, real, and unmeasured — the case league creation has to refuse
    // rather than quietly score at the English scale.
    expect(isCalibratedDomain("de")).toBe(false);
    expect(isCalibratedDomain("zzz")).toBe(false);
  });
});

describe("the bunching the factor exists to prevent", () => {
  it("scores a modest Italian article above zero", () => {
    // The regression in one line. `basePoints` floors at 2,000 raw views, so at
    // the old L=1.0 every Italian article under that scored a flat zero — ADR
    // 0002's "several drop to 0 credits below rank ~200", live in production.
    const viewsPerDay = 1_000;

    expect(basePoints(viewsPerDay)).toBe(0);
    expect(
      articleScore(viewsPerDay, resolveLanguageScale("it")),
    ).toBeGreaterThan(0);
  });

  it("separates Italian articles that used to share one bucket", () => {
    // Granularity, the factor's other job: three articles an order of magnitude
    // apart in readership must not all score the same.
    const scale = resolveLanguageScale("it");
    const quiet = articleScore(300, scale);
    const middling = articleScore(3_000, scale);
    const busy = articleScore(30_000, scale);

    expect(quiet).toBeLessThan(middling);
    expect(middling).toBeLessThan(busy);
  });
});
