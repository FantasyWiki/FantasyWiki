/**
 * Internal scoring-engine API shapes (docs/plan-scoring-engine.md §6).
 *
 * Consumed by `backend/src/routes/internal.ts`. The Kotlin scoring engine
 * re-declares equivalents on its side of the JVM boundary — ADR 0004 accepts
 * no type-sharing across runtimes, so these two must be kept in lockstep by
 * hand (and by the golden-vector test for the scoring math itself).
 */

/** One team's daily scoring inputs, as returned by GET /internal/scoring-inputs. */
export interface ScoringInputDTO {
  leagueId: string;
  teamId: string;
  /** League language domain (e.g. "en"), drives the Language Scale Factor. */
  domain: string;
  /** Formation schema, e.g. "4-3-3" — selects the chemistry-link topology. */
  schema: string;
  /**
   * position -> articleId (canonical Wikipedia title) for the slots filled by
   * an *active* contract (owned, not settled, not expired on the scored day).
   * Empty object for a team with a lineup but no active placements.
   */
  placements: Record<string, string>;
}

/** One team's computed daily result, as sent to POST /internal/performances. */
export interface PerformanceResultDTO {
  teamId: string;
  points: number;
  /** position -> articleId snapshot the engine scored (stored immutably). */
  formation: Record<string, string>;
}

/** Body of POST /internal/performances. Chunkable: the engine may send several. */
export interface PerformanceIngestDTO {
  /** Scored calendar day, YYYY-MM-DD. */
  date: string;
  results: PerformanceResultDTO[];
}
