import type { Domain } from "./enums";

/**
 * ADR 0005: locked contract-duration tiers, in days. This is the forward
 * (tier -> days) mapping the buy flow needs; `ContractDTO.tier` derives the
 * reverse (days -> tier) for display from an existing contract's duration.
 */
export type ContractTier = "SHORT" | "MEDIUM" | "LONG";

export const TIER_DAYS: Record<ContractTier, number> = {
  SHORT: 3,
  MEDIUM: 7,
  LONG: 14,
};

export function tierToDays(tier: ContractTier): number {
  return TIER_DAYS[tier];
}

/**
 * ADR 0002: per-language calibration constant (en = 1.0 reference).
 * Exact non-en values are still an open research item (scoring-system.md §9).
 */
export const LANGUAGE_SCALE: Record<Domain, number> = {
  en: 1.0,
  it: 1.0,
};

export function normalizedViews(rawViews: number, languageScale: number): number {
  return rawViews * languageScale;
}

/** Safe LANGUAGE_SCALE lookup — falls back to 1.0 (en reference) for any domain not in the map, so an unvalidated/bad domain never turns into NaN downstream. */
export function resolveLanguageScale(domain: Domain): number {
  return LANGUAGE_SCALE[domain] ?? 1.0;
}

/**
 * scoring-system.md §3 / ADR 0001: the exact same curve used for daily scoring —
 * log-compressed up to a 150k-view kink, linear tail above it. ADR 0005 reuses
 * this shape (not raw views) as the input to contract pricing, fed the 30-day
 * average instead of daily views, so price stays proportionate to the value it
 * buys instead of diverging from it. (A views^1.5 curve over raw views doesn't
 * work: pageviews are Zipfian, so any convexity applied directly to raw views
 * front-loads almost all price differentiation onto the extreme head of the
 * distribution — see ADR 0005's "how we got here".)
 */
const BASE_POINTS_ZERO_VIEWS = 2_000;
const BASE_POINTS_KINK_VIEWS = 150_000;
const BASE_POINTS_TAIL_VIEWS_PER_POINT = 50_000;
const BASE_POINTS_AT_KINK = Math.log2(BASE_POINTS_KINK_VIEWS / BASE_POINTS_ZERO_VIEWS);

function basePoints(views: number): number {
  if (views <= BASE_POINTS_KINK_VIEWS) {
    return Math.max(0, Math.log2(views / BASE_POINTS_ZERO_VIEWS));
  }
  return BASE_POINTS_AT_KINK + (views - BASE_POINTS_KINK_VIEWS) / BASE_POINTS_TAIL_VIEWS_PER_POINT;
}

/**
 * ADR 0005: price is convex in *points* (basePoints), not in raw views. The
 * exponent operates over the already-log-compressed points range (~5.7x
 * anchor-to-viral) instead of raw views' ~249x range, giving direct control
 * over the top-to-anchor price ratio without an emergent, distribution-driven
 * blowout.
 */
const PRICE_EXPONENT = 1.7;

/**
 * The coefficient is derived from a full-team budget target, not a legacy
 * low-band anchor — anchoring low no longer works once price is points-based
 * (points only span ~27x total, so any coefficient that preserves the old low
 * anchor leaves even a full 11-giant team costing a few hundred credits,
 * nowhere near gating against the starting budget; see ADR 0005). Target: an
 * 11-slot team of giant-band (~130k view) articles costs 1,800 credits at the
 * SHORT (3-day) tier — 1.8x the 1,000-credit starting budget, gated behind
 * grinding rather than day-one affordable.
 */
const CALIBRATION_TEAM_SIZE = 11;
const CALIBRATION_GIANT_VIEWS = 130_000;
const CALIBRATION_SHORT_DAYS = TIER_DAYS.SHORT;
const CALIBRATION_FULL_GIANT_TEAM_PRICE = 1_800;
const PRICE_COEFFICIENT =
  CALIBRATION_FULL_GIANT_TEAM_PRICE /
  (CALIBRATION_TEAM_SIZE * Math.pow(basePoints(CALIBRATION_GIANT_VIEWS), PRICE_EXPONENT) * CALIBRATION_SHORT_DAYS);

/**
 * ContractPrice (ADR 0005): `D × basePoints(Normalized_30dAvg_Views)^k × days`.
 * `normalizedAvg30dViews` must already have the Language Scale Factor applied
 * (see `normalizedViews`) and must be the 30-day average, never daily views.
 * Genuinely floors at 0 for sub-2,000-view articles (`basePoints` itself is 0
 * there) — intentional (ADR 0003): a broke player always has free inventory to
 * speculate with, not an artifact to round away.
 */
export function computeContractPrice(normalizedAvg30dViews: number, days: number): number {
  const price = PRICE_COEFFICIENT * Math.pow(basePoints(normalizedAvg30dViews), PRICE_EXPONENT) * days;
  if (!Number.isFinite(price)) return 0; // NaN/Infinity input (e.g. bad domain scale) -> floor, never propagate
  return Math.max(0, Math.round(price));
}
