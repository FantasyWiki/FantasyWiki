import { League } from "../../../model";
import { LeagueDTO } from "../../../dto/leagueDTO";
import { Domain } from "../../../model/enums";
import { LeagueRepository } from "../repositories/leagueRepository";
import { LeagueRepositoryD1 } from "../repositories/d1/leagueRepositoryD1";
import { Result, success } from "../repositories/result";

export const GLOBAL_LEAGUE_ID = "global";

/**
 * Map a domain League to the LeagueDTO shape returned by the API.
 * `teams` is populated by team-scoped endpoints, not here.
 */
export function toLeagueDTO(league: League): LeagueDTO {
  return {
    id: league.id,
    title: league.name,
    domain: league.domain as Domain,
    icon: league.icon,
    startDate: league.startDate,
    endDate: league.endDate,
    teams: [],
  };
}

export class LeagueService {
  private repository: LeagueRepository;

  constructor(repositoryOrDb: LeagueRepository | D1Database) {
    if ("getById" in repositoryOrDb) {
      this.repository = repositoryOrDb;
      return;
    }
    this.repository = new LeagueRepositoryD1(repositoryOrDb);
  }

  async getGlobalLeague(): Promise<Result<LeagueDTO>> {
    const result = await this.repository.getById(GLOBAL_LEAGUE_ID);
    if (!result.ok) {
      return result;
    }
    return success(toLeagueDTO(result.value));
  }
}
