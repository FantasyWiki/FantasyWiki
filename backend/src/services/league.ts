import { GLOBAL_LEAGUE_ID, League } from "../../../model";
import { LeagueDTO, LeagueInviteDTO } from "../../../dto/leagueDTO";
import { Domain, LeagueInvitePolicy } from "../../../model/enums";
import {
  LEAGUE_ERRORS,
  LeagueRepository,
} from "../repositories/leagueRepository";
import { LeagueRepositoryD1 } from "../repositories/d1/leagueRepositoryD1";
import { Result, failure, success } from "../repositories/result";

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
    visibility: league.visibility,
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
   * player's selection.
   *
   * Deliberately not membership-scoped, and that stays true now that leagues
   * can be private: the id lets you *read* a league, the invitation code lets
   * you *join* one. Someone handed an invite link should be able to see the
   * league's standings and dates before committing to it, and the standings
   * are already served unscoped by `/:id/leaderboard` anyway. What the id no
   * longer is — as this comment used to claim — is the invite itself.
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
   * A league's invitation code, for a caller allowed to hand it out.
   *
   * The rule is the league's own `invitePolicy`: under `members` anyone
   * fielding a team can invite, under `admin` only the league's admin can.
   * A caller who fails it gets the same answer as a caller asking about a
   * league that is not there — `api-naming-rules.md` §5 leaves the choice of
   * 403 vs 404 to how much you want to reveal, and revealing that a code
   * exists to be guessed at is exactly what this endpoint should not do.
   */
  async getInvitationCode(
    playerId: string,
    leagueId: string,
    isMember: boolean,
  ): Promise<Result<LeagueInviteDTO>> {
    const leagueResult = await this.repository.getById(leagueId);
    if (!leagueResult.ok) {
      return leagueResult;
    }
    const league = leagueResult.value;

    const allowed =
      league.invitePolicy === LeagueInvitePolicy.MEMBERS
        ? isMember
        : league.adminId === playerId;
    if (!allowed) {
      return failure(LEAGUE_ERRORS.NOT_FOUND);
    }

    const codeResult = await this.repository.getInvitationCode(leagueId);
    if (!codeResult.ok) {
      return codeResult;
    }
    if (codeResult.value === null) {
      // A league predating the creation path that issues codes. Nothing to
      // hand out, and inventing one here would be a write hiding in a read.
      return failure(LEAGUE_ERRORS.NO_INVITATION_CODE);
    }
    return success({ code: codeResult.value });
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
