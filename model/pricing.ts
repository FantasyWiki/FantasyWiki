import type { Domain } from "./enums";
import { basePoints } from "./scoring";

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
 * ADR 0002: `L(domain) = median(en_views[i] / domain_views[i])` over rank-matched
 * 30-day averages, lifting every edition onto the `en` reference of 1.0.
 *
 * These are **measured** values, not placeholders. `it = 13.9` is the figure
 * ADR 0002 records from its rank-matched 2026-07-06 snapshot; it sat at `1.0`
 * here for a year of code while the ADR said otherwise, which meant every
 * Italian article under 2,000 views/day scored a flat zero — precisely the
 * bunching the factor exists to prevent. At 13.9 that floor is 144 views/day.
 *
 * Changing an entry **re-rates every contract already priced in that domain**,
 * so a value only lands here once it is measured, never as a stand-in. That is
 * the same rule ADR 0002 states for new domains: calibration is frozen before
 * the first price is computed, because a factor backfilled later would silently
 * re-price contracts nobody touched. An edition absent from this table has not
 * been measured and cannot host a league — see {@link isCalibratedDomain}.
 */
export const LANGUAGE_SCALE: Record<string, number> = {
  en: 1.0,
  it: 13.9,
};

/**
 * Whether an edition's Language Scale Factor has actually been measured.
 *
 * Distinct from `resolveLanguageScale` returning a number: that one always
 * answers, because a bad domain reaching the scoring path must not become NaN.
 * This is the question league creation has to ask *before* the fact — an
 * uncalibrated edition is one a league may not be founded on, rather than one
 * that quietly plays at the English scale.
 */
export function isCalibratedDomain(domain: string): boolean {
  return domain in LANGUAGE_SCALE;
}

export function normalizedViews(rawViews: number, languageScale: number): number {
  return rawViews * languageScale;
}

/** Safe LANGUAGE_SCALE lookup — falls back to 1.0 (en reference) for any domain not in the map, so an unvalidated/bad domain never turns into NaN downstream. */
export function resolveLanguageScale(domain: Domain): number {
  return LANGUAGE_SCALE[domain] ?? 1.0;
}

/**
 * ADR 0005: price is convex in *points* (basePoints), not in raw views. The
 * `basePoints` curve is the *exact same* one daily scoring uses — it lives in
 * `scoring.ts` (one curve, one place to tune, scoring-system.md §6.1); pricing
 * just feeds it the 30-day average instead of daily views. The exponent operates
 * over the already-log-compressed points range (~5.7x
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

/** ContractPrice (ADR 0005) at `days` from raw (not normalized) average views — for owned contracts `days` must come from the contract's own held tier, not a fixed tier, or the value-delta vs purchasePrice is spurious. */
export function computeCurrentPrice(
  averageViews30d: number,
  domain: Domain,
  days: number
): number {
  const normalized = normalizedViews(averageViews30d, resolveLanguageScale(domain));
  return computeContractPrice(normalized, days);
}
