import { League } from "../../../model";
import { Result } from "./result";

export const LEAGUE_ERRORS = {
  NOT_FOUND: "League not found",
} as const;

export interface LeagueRepository {
  getById(id: string): Promise<Result<League>>;
  /**
   * How many teams play each of the given leagues, keyed by league id; a
   * league with no teams maps to 0 rather than being absent.
   *
   * Its own read rather than a column on `getById`, because the count is a
   * derived number that only the surfaces rendering a `LeagueDTO` care about,
   * whereas `getById` is what five services call to find a league's domain.
   * Taking the ids in bulk is what keeps the league list to one query instead
   * of one per league.
   */
  countTeamsByLeague(
    leagueIds: readonly string[],
  ): Promise<Result<Record<string, number>>>;
}
