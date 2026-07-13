import { Temporal } from "@js-temporal/polyfill";
import { Performance } from "../../../model";
import { Result } from "./result";

export interface TeamCumulative {
  teamId: string;
  teamName: string;
  teamCredits: number;
  playerId: string;
  playerName: string;
  cumulativeLatest: number;
  cumulativePrevious: number;
}

/** One team's computed daily performance, written by the scoring engine. */
export interface PerformanceUpsertRow {
  teamId: string;
  points: number;
  /**
   * Pre-serialized position->articleId snapshot, stored verbatim as
   * historical_formation. Opaque here — the engine relayed it untouched.
   */
  formationSnapshot: string;
}

export interface PerformanceRepository {
  getRecentByTeam(
    teamId: string,
    limit: number,
  ): Promise<Result<Performance[]>>;
  getLeagueCumulatives(leagueId: string): Promise<Result<TeamCumulative[]>>;
  /**
   * Idempotent daily upsert keyed on (teamId, date) — safe to re-run for the
   * same day. Chunked internally so a large sweep stays within D1's per-batch
   * statement limits (docs/plan-scoring-engine.md §6).
   */
  upsertDaily(
    date: Temporal.PlainDate,
    rows: PerformanceUpsertRow[],
  ): Promise<Result<void>>;
}
