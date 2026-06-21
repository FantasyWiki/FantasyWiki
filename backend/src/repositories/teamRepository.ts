import { Team } from "../../../model";
import { Result } from "./result";

export interface TeamRepository {
  create(team: {
    name: string;
    playerId: string;
    leagueId: string;
    credits: number;
  }): Promise<Result<Team>>;
  existsByNameInLeague(
    name: string,
    leagueId: string,
  ): Promise<Result<boolean>>;
}
