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

export interface PerformanceRepository {
  getRecentByTeam(
    teamId: string,
    limit: number,
  ): Promise<Result<Performance[]>>;
  getLeagueCumulatives(leagueId: string): Promise<Result<TeamCumulative[]>>;
}
