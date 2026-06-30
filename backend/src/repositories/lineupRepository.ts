import { Lineup } from "../../../model";
import { Result } from "./result";

export interface LineupRepository {
  getByTeamId(teamId: string): Promise<Result<Lineup | null>>;
  upsert(data: {
    teamId: string;
    schema: string;
    formation: string;
    updatedAt: string;
  }): Promise<Result<void>>;
}
