import { GLOBAL_LEAGUE_ID, League } from "../../../model";
import { LeagueDTO } from "../../../dto/leagueDTO";
import { Domain } from "../../../model/enums";
import { LeagueRepository } from "../repositories/leagueRepository";
import { LeagueRepositoryD1 } from "../repositories/d1/leagueRepositoryD1";
import { Result, success } from "../repositories/result";

// Re-exported for existing importers; the source of truth lives in the shared
// model so the frontend can reason about the same league without duplicating
// the id.
export { GLOBAL_LEAGUE_ID };

/**
 * Map a domain League and the size of its field to the LeagueDTO the API
 * returns. The count is passed in rather than read off the league because it
 * is derived from the `teams` table — `model/League` says what a league is,
 * not how many have joined it.
 */
export function toLeagueDTO(league: League, teamCount: number): LeagueDTO {
  return {
    id: league.id,
    title: league.name,
    domain: league.domain as Domain,
    icon: league.icon,
    startDate: league.startDate,
    endDate: league.endDate,
    teamCount,
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
    return this.getLeagueById(GLOBAL_LEAGUE_ID);
  }

  /**
   * A single league by id, for the surfaces that name one in their URL — the
   * league page and the join-a-further-league form — rather than reading the
   * player's selection. Deliberately not membership-scoped: the standings of a
   * league are already served unscoped by `/:id/leaderboard`, and a private
   * league's id is the invite.
   */
  async getLeagueById(id: string): Promise<Result<LeagueDTO>> {
    const result = await this.repository.getById(id);
    if (!result.ok) {
      return result;
    }
    const counts = await this.repository.countTeamsByLeague([id]);
    if (!counts.ok) {
      return counts;
    }
    return success(toLeagueDTO(result.value, counts.value[id] ?? 0));
  }

  /**
   * Dress a set of leagues the caller already holds — the player's own, which
   * `PlayerService` resolves — as DTOs. The counts are fetched for the whole
   * set in one read, which is the reason this takes a list rather than being
   * called once per league.
   */
  async toLeagueDTOs(leagues: League[]): Promise<Result<LeagueDTO[]>> {
    const counts = await this.repository.countTeamsByLeague(
      leagues.map((l) => l.id),
    );
    if (!counts.ok) {
      return counts;
    }
    return success(
      leagues.map((league) =>
        toLeagueDTO(league, counts.value[league.id] ?? 0),
      ),
    );
  }
}
