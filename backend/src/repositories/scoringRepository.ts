import { Temporal } from "@js-temporal/polyfill";
import { Result } from "./result";

/**
 * A team's lineup joined with its league's domain and frozen Language Scale
 * Factor (one row per team with a lineup).
 */
export interface TeamLineupRow {
  teamId: string;
  leagueId: string;
  domain: string;
  /** The league's frozen factor — what its scores are normalized by (ADR 0002). */
  languageScale: number;
  schema: string;
  /** Stored lineup JSON: position -> contractId. */
  formation: string;
}

/** A contract active (owned, unsettled, unexpired) on the scored day. */
export interface ActiveContractRow {
  id: string;
  teamId: string;
  articleId: string;
}

/**
 * Read side of the scoring loop: the cross-league inputs the engine needs to
 * score a day. Kept separate from the per-team/per-league repositories because
 * scoring sweeps *every* team in one shot (docs/architecture/scoring-pipeline.md).
 */
export interface ScoringRepository {
  getTeamLineups(): Promise<Result<TeamLineupRow[]>>;
  getActiveContracts(
    date: Temporal.PlainDate,
  ): Promise<Result<ActiveContractRow[]>>;
}
