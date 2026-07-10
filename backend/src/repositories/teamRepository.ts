import { Team } from "../../../model";
import { Result } from "./result";

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
}
