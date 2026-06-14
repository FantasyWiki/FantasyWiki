import { League } from "../../../model";
import { Result } from "./result";

export interface LeagueRepository {
  getById(id: string): Promise<Result<League>>;
}
