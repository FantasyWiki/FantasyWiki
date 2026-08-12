import { Team } from "../../../model";
import { TeamDTO } from "../../../dto/teamDTO";
import { TeamRepository } from "../repositories/teamRepository";
import { TeamRepositoryD1 } from "../repositories/d1/teamRepositoryD1";
import { LineupRepository } from "../repositories/lineupRepository";
import { LineupRepositoryD1 } from "../repositories/d1/lineupRepositoryD1";
import { Result, failure, success } from "../repositories/result";

export type TeamServiceDeps = {
  teamRepository: TeamRepository;
  lineupRepository: LineupRepository;
};

export class TeamService {
  private teamRepository: TeamRepository;
  private lineupRepository: LineupRepository;

  constructor(depsOrDb: TeamServiceDeps | D1Database) {
    const deps =
      "teamRepository" in depsOrDb
        ? depsOrDb
        : TeamService.d1Deps(depsOrDb as D1Database);
    this.teamRepository = deps.teamRepository;
    this.lineupRepository = deps.lineupRepository;
  }

  private static d1Deps(db: D1Database): TeamServiceDeps {
    return {
      teamRepository: new TeamRepositoryD1(db),
      lineupRepository: new LineupRepositoryD1(db),
    };
  }

  async createTeam(
    playerId: string,
    leagueId: string,
    name: string,
  ): Promise<Result<Team>> {
    const trimmed = name.trim();

    if (trimmed.length < 3 || trimmed.length > 30) {
      return failure("Team name must be between 3 and 30 characters.");
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
      return failure("You already have a team in this league.");
    }

    const existsResult = await this.teamRepository.existsByNameInLeague(
      trimmed,
      leagueId,
    );
    if (!existsResult.ok) {
      return existsResult;
    }
    if (existsResult.value) {
      return failure(
        "This team name is already taken in this league. Please choose another.",
      );
    }

    const teamResult = await this.teamRepository.create({
      name: trimmed,
      playerId,
      leagueId,
    });
    if (!teamResult.ok) return teamResult;

    const lineupResult = await this.lineupRepository.upsert({
      teamId: teamResult.value.id,
      schema: "4-3-3",
      formation: "{}",
      updatedAt: new Date().toISOString(),
    });
    if (!lineupResult.ok) return lineupResult;

    return teamResult;
  }

  /**
   * The team a league contains under this id, or null when it contains no such
   * team. The league is half the key rather than a filter applied to the
   * answer, so a team belonging to another league is absent here rather than
   * readable — this serves reads whose team id comes from the client.
   */
  async getTeamInLeague(
    teamId: string,
    leagueId: string,
  ): Promise<Result<Team | null>> {
    return this.teamRepository.getByIdAndLeague(teamId, leagueId);
  }

  /**
   * The team this player fields in this league, or null when they field none.
   * The self-scoped counterpart to {@link getTeamInLeague}: the caller holds a
   * player id from the session rather than a team id from a URL.
   *
   * Returns the domain model, so callers that must go on to resolve things the
   * team only points at — its owner's name, its contracts — have what they need.
   * {@link getMyTeam} is this read dressed for the wire.
   */
  async getPlayerTeamInLeague(
    playerId: string,
    leagueId: string,
  ): Promise<Result<Team | null>> {
    return this.teamRepository.getByPlayerAndLeague(playerId, leagueId);
  }

  async getMyTeam(
    playerId: string,
    leagueId: string,
    playerName: string,
  ): Promise<Result<TeamDTO | null>> {
    const result = await this.getPlayerTeamInLeague(playerId, leagueId);
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
