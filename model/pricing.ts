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
 * ADR 0005: price is convex (superlinear) in views, not linear. The anchor
 * point pins the curve so the rank~1000 band (9,000 views, 7 days) keeps the
 * same *pre-scale* rate the old linear formula gave it (9 credits) — only
 * articles above that band get progressively more expensive per marginal
 * view. This is what keeps mid/long-tail pricing unchanged while gating a
 * top-tier team behind grinding rather than the day-one budget.
 */
const PRICE_EXPONENT = 1.5;
const ANCHOR_VIEWS = 9000;
const ANCHOR_DAYS = 7;
const ANCHOR_PRICE = (ANCHOR_VIEWS / 7000) * ANCHOR_DAYS; // 9 — the superseded linear formula's rate at the anchor
const PRICE_COEFFICIENT =
  ANCHOR_PRICE / (Math.pow(ANCHOR_VIEWS, PRICE_EXPONENT) * ANCHOR_DAYS);

/**
 * ADR 0005 addendum: above this view count, price switches from the convex
 * curve to a linear tail (same threshold as the base-scoring kink, ADR 0001)
 * so a single viral outlier's price grows at a fixed rate instead of
 * unbounded views^1.5 — real observed data (a 638k-view event article
 * pricing at 5,374+ credits, over 5x the starting budget for one slot) showed
 * the uncapped curve made the top of the market unusably extreme.
 */
const TAIL_KINK_VIEWS = 150_000;
const TAIL_CREDITS_PER_VIEW_PER_DAY = 1 / 300 / ANCHOR_DAYS; // "+1 credit per 300 views above the kink" at the MEDIUM (7d) tier, expressed per-day so the rate is actually tier-invariant
const KINK_PRICE_PER_DAY = PRICE_COEFFICIENT * Math.pow(TAIL_KINK_VIEWS, PRICE_EXPONENT);

/**
 * ADR 0005 addendum: the whole economy (price + starting budget, see
 * `STARTING_CREDITS`) is scaled up so integer-rounded credits keep the
 * resolution that floating-point views^1.5 previously lost below ~1,300
 * views (where the un-scaled price rounds to 0).
 */
const CREDIT_SCALE = 10;

function rawCurvePrice(normalizedAvg30dViews: number, days: number): number {
  if (normalizedAvg30dViews <= TAIL_KINK_VIEWS) {
    return PRICE_COEFFICIENT * Math.pow(normalizedAvg30dViews, PRICE_EXPONENT) * days;
  }
  const pricePerDay =
    KINK_PRICE_PER_DAY + (normalizedAvg30dViews - TAIL_KINK_VIEWS) * TAIL_CREDITS_PER_VIEW_PER_DAY;
  return pricePerDay * days;
}

/**
 * ContractPrice (ADR 0005): convex below the 150k kink, linear above it,
 * scaled x10, floored at 1 so no article with measurable traffic prices at 0.
 * `normalizedAvg30dViews` must already have the Language Scale Factor applied
 * (see `normalizedViews`) and must be the 30-day average, never daily views.
 */
export function computeContractPrice(
  normalizedAvg30dViews: number,
  days: number,
): number {
  const scaled = rawCurvePrice(normalizedAvg30dViews, days) * CREDIT_SCALE;
  if (!Number.isFinite(scaled)) return 1; // NaN/Infinity input (e.g. bad domain scale) -> floor, never propagate
  return Math.max(1, Math.round(scaled));
}
