import { TeamDTO } from "./teamDTO";

export interface LeaderboardEntryDTO {
  team: TeamDTO;
  cumulativePoints: number;
  rank: number;
  rankDelta: number | null;
}
