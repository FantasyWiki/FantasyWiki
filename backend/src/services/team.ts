import { Team } from "../../../model";
import { TeamDTO } from "../../../dto/teamDTO";
import { TeamRepository } from "../repositories/teamRepository";
import { TeamRepositoryD1 } from "../repositories/d1/teamRepositoryD1";
import { LineupRepository } from "../repositories/lineupRepository";
import { LineupRepositoryD1 } from "../repositories/d1/lineupRepositoryD1";
import { Result, failure, success } from "../repositories/result";

// ADR 0003/0005: 1,000 credits — no scale factor needed, points-based pricing
// doesn't reproduce the rounding-to-zero issue the old views^1.5 formula had.
export const STARTING_CREDITS = 1000;

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
      credits: STARTING_CREDITS,
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
