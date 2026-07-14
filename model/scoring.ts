import type { ChemistryLevel } from "./enums";

/**
 * The single source of truth for FantasyWiki's daily-scoring math
 * (scoring-system.md §3–§5). Framework-agnostic — consumed by the backend Worker
 * at ingest time and by vitest.
 *
 * The Kotlin scoring engine deliberately holds *none* of this: it fetches raw
 * Wikimedia signals (per-article daily views + each Chemistry Link's direction)
 * and POSTs them, and the backend scores here. That keeps `basePoints` — and the
 * synergy values, the team cap, and the Language Scale Factor — in exactly one
 * implementation instead of a JS/JVM pair kept in sync by hand.
 */

/**
 * scoring-system.md §3 / ADR 0001: log-compressed up to a 150k-view kink, linear
 * tail above it. This is the one canonical curve — daily scoring calls it on the
 * day's views, and contract pricing (`pricing.ts`, ADR 0005) reuses the *same*
 * function on the 30-day average, so price stays proportionate to the value it
 * buys. (A views^1.5 curve over raw views doesn't work: pageviews are Zipfian, so
 * any convexity applied directly to raw views front-loads almost all price
 * differentiation onto the extreme head of the distribution — see ADR 0005.)
 */
const BASE_POINTS_ZERO_VIEWS = 2_000;
const BASE_POINTS_KINK_VIEWS = 150_000;
const BASE_POINTS_TAIL_VIEWS_PER_POINT = 50_000;
const BASE_POINTS_AT_KINK = Math.log2(BASE_POINTS_KINK_VIEWS / BASE_POINTS_ZERO_VIEWS);

export function basePoints(views: number): number {
  if (views <= BASE_POINTS_KINK_VIEWS) {
    return Math.max(0, Math.log2(views / BASE_POINTS_ZERO_VIEWS));
  }
  return BASE_POINTS_AT_KINK + (views - BASE_POINTS_KINK_VIEWS) / BASE_POINTS_TAIL_VIEWS_PER_POINT;
}

/**
 * scoring-system.md §4: additive flat points per resolved Chemistry Link, keyed
 * on the canonical `ChemistryLevel` (CONTEXT.md vocabulary) the engine derives
 * from the Wikipedia link graph — `excellent` = mutual link, `good` = one-way,
 * `weak` = both placed but no link, `empty` = a slot unfilled. Mutual is 3× one-
 * way. This is the *authoritative* scoring model and supersedes the deprecated,
 * display-only `CHEMISTRY_MULTIPLIER_BY_LEVEL` (chemistry is additive, never a
 * multiplier — ADR 0001).
 */
const SYNERGY_POINTS_BY_LEVEL: Record<ChemistryLevel, number> = {
  excellent: 1.5,
  good: 0.5,
  weak: 0,
  empty: 0,
};

export function synergyPoints(level: ChemistryLevel): number {
  return SYNERGY_POINTS_BY_LEVEL[level];
}

/** scoring-system.md §4: team synergy is the summed link values, capped at 20 to guard all-mutual builds. */
export const TEAM_SYNERGY_CAP = 20;

export function teamSynergy(levels: ChemistryLevel[]): number {
  const total = levels.reduce((sum, level) => sum + synergyPoints(level), 0);
  return Math.min(TEAM_SYNERGY_CAP, total);
}

/**
 * scoring-system.md §2–§3: one article's daily Base Points, on Normalized Views
 * (`rawViews × L`). Scoring uses today's daily views (volatile), unlike pricing's
 * 30-day average.
 */
export function articleScore(rawViews: number, languageScale: number): number {
  return basePoints(rawViews * languageScale);
}

/**
 * scoring-system.md §5: a team's daily score — Σ article Base Points + capped
 * team synergy. `rawViews` are the placed articles' daily views (any order);
 * `levels` are the resolved Chemistry Links for the schema's placed pairs. Event
 * bonuses (§7) are deferred and contribute 0.
 */
export function teamDailyScore(
  rawViews: number[],
  languageScale: number,
  levels: ChemistryLevel[]
): number {
  const base = rawViews.reduce((sum, views) => sum + articleScore(views, languageScale), 0);
  return base + teamSynergy(levels);
}
