/**
 * Internal scoring-engine API shapes (docs/plan-scoring-engine.md §6).
 *
 * Consumed by `backend/src/routes/internal.ts`. The Kotlin scoring engine
 * re-declares equivalents on its side of the JVM boundary — ADR 0004 accepts
 * no type-sharing across runtimes, so these two must be kept in lockstep by
 * hand (and by the golden-vector test for the scoring math itself).
 */

/**
 * One team's daily scoring inputs, as returned by GET /internal/scoring-inputs.
 *
 * Deliberately free of any formation/schema/position concepts: the backend owns
 * all of that (it resolves `CHEMISTRY_LINKS[schema]` against the placed
 * articles) and hands the engine only the flat data it needs to score. Adding a
 * new formation schema therefore never touches the Kotlin engine.
 */
export interface ScoringInputDTO {
  leagueId: string;
  teamId: string;
  /** League language domain (e.g. "en"), drives the Language Scale Factor. */
  domain: string;
  /**
   * The placed, active articles to score for base points (canonical Wikipedia
   * titles). Empty for a team with a lineup but no active placements.
   */
  articles: string[];
  /**
   * Article pairs whose chemistry to evaluate — the schema's Chemistry Links,
   * already resolved by the backend to the articles placed on both endpoints
   * (pairs with an empty endpoint are omitted). The engine decides mutual /
   * one-way / none per pair and sums the synergy points; it never sees the
   * positions or schema behind them.
   */
  chemistryLinks: Array<[string, string]>;
  /**
   * Opaque formation snapshot (a serialized position->articleId map) the engine
   * echoes back verbatim in its result for immutable storage. The engine never
   * parses it — it is carried through untouched.
   */
  formationSnapshot: string;
}

/** One team's computed daily result, as sent to POST /internal/performances. */
export interface PerformanceResultDTO {
  teamId: string;
  points: number;
  /** The opaque `formationSnapshot` echoed back from the matching input. */
  formationSnapshot: string;
}

/** Body of POST /internal/performances. Chunkable: the engine may send several. */
export interface PerformanceIngestDTO {
  /** Scored calendar day, YYYY-MM-DD. */
  date: string;
  results: PerformanceResultDTO[];
}
