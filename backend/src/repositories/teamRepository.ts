import { Team } from "../../../model";
import { Result } from "./result";

export const TEAM_ERRORS = {
  /**
   * `getByPlayerAndLeague` returned null: the player has no team in this
   * league. Every self-scoped feature (contracts, lineup, ...) hits the same
   * wall, so they all surface this one message rather than each writing their
   * own — routes compare against it by identity to answer 404.
   */
  NO_TEAM_IN_LEAGUE: "No team found for this league",

  // The four ways `createTeam` can refuse. These were free text until the join
  // gate arrived: the route mapped every failure to 400, which was survivable
  // while every failure really was the client's fault. A permission refusal is
  // a 403 and a missing league a 404, and a status map cannot be built out of
  // message content (docs/architecture/backend-error-constants.md).
  NAME_LENGTH: "Team name must be between 3 and 30 characters.",
  NAME_TAKEN:
    "This team name is already taken in this league. Please choose another.",
  ALREADY_HAS_TEAM: "You already have a team in this league.",
  /**
   * The league is private and the caller offered no invitation code, or the
   * wrong one. Deliberately one error rather than "code required" and "code
   * wrong": telling a stranger which of the two it was tells them whether a
   * code they hold is close.
   */
  LEAGUE_IS_PRIVATE: "This league is private. An invitation code is required.",
  /**
   * The guarded INSERT rejected the join. The write cannot know *which* of its
   * conditions failed and must not guess — `TeamService` re-reads to name the
   * cause, the same protocol as `CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT`.
   */
  JOIN_CONFLICT: "Join conditions no longer hold",
} as const;

export type TeamError = (typeof TEAM_ERRORS)[keyof typeof TEAM_ERRORS];

export interface TeamRepository {
  /**
   * credits is not a param: a brand-new team has zero contracts, so its
   * derived credits is trivially STARTING_CREDITS.
   *
   * `invitationCode` is the code the joiner presented, if any. The league's
   * own rules — public, or private and this code matches, or private and this
   * is the admin — are evaluated *inside* the INSERT rather than checked
   * first, because D1 has no interactive transactions and a check followed by
   * a write is a race. Rejection surfaces as `TEAM_ERRORS.JOIN_CONFLICT`.
   */
  create(team: {
    name: string;
    playerId: string;
    leagueId: string;
    invitationCode?: string;
  }): Promise<Result<Team>>;
  existsByNameInLeague(
    name: string,
    leagueId: string,
  ): Promise<Result<boolean>>;
  getByPlayerAndLeague(
    playerId: string,
    leagueId: string,
  ): Promise<Result<Team | null>>;
}
