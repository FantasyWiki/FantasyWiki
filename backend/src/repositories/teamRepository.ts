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
} as const;

export interface TeamRepository {
  /** credits is not a param: a brand-new team has zero contracts, so its
   * derived credits is trivially STARTING_CREDITS. */
  create(team: {
    name: string;
    playerId: string;
    leagueId: string;
  }): Promise<Result<Team>>;
  existsByNameInLeague(
    name: string,
    leagueId: string,
  ): Promise<Result<boolean>>;
  getByPlayerAndLeague(
    playerId: string,
    leagueId: string,
  ): Promise<Result<Team | null>>;
  /**
   * The league is part of the key, not a redundant filter: this serves reads
   * addressed by team id from a league context, so a team belonging to another
   * league must be indistinguishable from one that does not exist (null), never
   * a row from outside the league the caller asked about.
   */
  getByIdAndLeague(
    teamId: string,
    leagueId: string,
  ): Promise<Result<Team | null>>;
}
