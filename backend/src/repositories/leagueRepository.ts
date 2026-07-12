import { League } from "../../../model";
import { Result } from "./result";

export const LEAGUE_ERRORS = {
  NOT_FOUND: "League not found",
} as const;

export interface LeagueRepository {
  getById(id: string): Promise<Result<League>>;
}
