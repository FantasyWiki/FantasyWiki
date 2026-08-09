import { Team } from "../../../model";
import { DEFAULT_SCHEMA } from "../../../model/lineup";
import { normalizeInvitationCode } from "../../../model/league";
import {
  TEAM_NAME_MAX_LENGTH,
  TEAM_NAME_MIN_LENGTH,
} from "../../../model/team";
import { TeamDTO } from "../../../dto/teamDTO";
import { TEAM_ERRORS, TeamRepository } from "../repositories/teamRepository";
import { TeamRepositoryD1 } from "../repositories/d1/teamRepositoryD1";
import { LeagueRepository } from "../repositories/leagueRepository";
import { LeagueRepositoryD1 } from "../repositories/d1/leagueRepositoryD1";
import { LineupRepository } from "../repositories/lineupRepository";
import { LineupRepositoryD1 } from "../repositories/d1/lineupRepositoryD1";
import { Result, failure, success } from "../repositories/result";

export type TeamServiceDeps = {
  teamRepository: TeamRepository;
  lineupRepository: LineupRepository;
  leagueRepository: LeagueRepository;
};

export class TeamService {
  private teamRepository: TeamRepository;
  private lineupRepository: LineupRepository;
  private leagueRepository: LeagueRepository;

  constructor(depsOrDb: TeamServiceDeps | D1Database) {
    const deps =
      "teamRepository" in depsOrDb
        ? depsOrDb
        : TeamService.d1Deps(depsOrDb as D1Database);
    this.teamRepository = deps.teamRepository;
    this.lineupRepository = deps.lineupRepository;
    this.leagueRepository = deps.leagueRepository;
  }

  private static d1Deps(db: D1Database): TeamServiceDeps {
    return {
      teamRepository: new TeamRepositoryD1(db),
      lineupRepository: new LineupRepositoryD1(db),
      leagueRepository: new LeagueRepositoryD1(db),
    };
  }

  /**
   * Join a league by naming a team in it.
   *
   * `invitationCode` is only consulted for a private league; a public one
   * ignores whatever is passed. The league's entry rules are enforced by the
   * INSERT itself (see `TeamRepositoryD1.create`) — everything before it is
   * advisory, there to answer in words rather than to decide.
   */
  async createTeam(
    playerId: string,
    leagueId: string,
    name: string,
    invitationCode?: string,
  ): Promise<Result<Team>> {
    const trimmed = name.trim();

    if (
      trimmed.length < TEAM_NAME_MIN_LENGTH ||
      trimmed.length > TEAM_NAME_MAX_LENGTH
    ) {
      return failure(TEAM_ERRORS.NAME_LENGTH);
    }

    // A player has at most one team per league. `UNIQUE (playerId, leagueId)`
    // is what actually guarantees that — this check is not atomic with the
    // insert and is not meant to be. It exists so the ordinary way of hitting
    // the rule (asking for a second team) answers in words instead of leaking
    // the constraint failure the repository would otherwise wrap and return.
    const ownTeamResult = await this.teamRepository.getByPlayerAndLeague(
      playerId,
      leagueId,
    );
    if (!ownTeamResult.ok) {
      return ownTeamResult;
    }
    if (ownTeamResult.value) {
      return failure(TEAM_ERRORS.ALREADY_HAS_TEAM);
    }

    const existsResult = await this.teamRepository.existsByNameInLeague(
      trimmed,
      leagueId,
    );
    if (!existsResult.ok) {
      return existsResult;
    }
    if (existsResult.value) {
      return failure(TEAM_ERRORS.NAME_TAKEN);
    }

    const teamResult = await this.teamRepository.create({
      name: trimmed,
      playerId,
      leagueId,
      invitationCode: invitationCode
        ? normalizeInvitationCode(invitationCode)
        : undefined,
    });
    if (!teamResult.ok) {
      return teamResult.error === TEAM_ERRORS.JOIN_CONFLICT
        ? this.joinRejection(playerId, leagueId)
        : teamResult;
    }

    const lineupResult = await this.lineupRepository.upsert({
      teamId: teamResult.value.id,
      schema: DEFAULT_SCHEMA,
      formation: "{}",
      updatedAt: new Date().toISOString(),
    });
    if (!lineupResult.ok) return lineupResult;

    return teamResult;
  }

  /**
   * Name the reason the guarded INSERT turned a join down. It matched no row,
   * which means either the league is not there or its entry rules said no —
   * re-reading is the only way to tell, and it is why the repository returns a
   * single sentinel instead of guessing.
   */
  private async joinRejection(
    playerId: string,
    leagueId: string,
  ): Promise<Result<never>> {
    const leagueResult = await this.leagueRepository.getById(leagueId);
    if (!leagueResult.ok) {
      // Includes LEAGUE_ERRORS.NOT_FOUND, which is the honest answer for a
      // league id that does not exist. Before the gate this silently attempted
      // an insert and surfaced a foreign-key failure as a 400.
      return leagueResult;
    }
    return failure(TEAM_ERRORS.LEAGUE_IS_PRIVATE);
  }

  async getMyTeam(
    playerId: string,
    leagueId: string,
    playerName: string,
  ): Promise<Result<TeamDTO | null>> {
    const result = await this.teamRepository.getByPlayerAndLeague(
      playerId,
      leagueId,
    );
    if (!result.ok) {
      return result;
    }
    if (result.value === null) {
      return success(null);
    }
    const team: Team = result.value;
    return success({
      id: team.id,
      name: team.name,
      credits: team.credits,
      player: { id: playerId, name: playerName },
    });
  }
}
