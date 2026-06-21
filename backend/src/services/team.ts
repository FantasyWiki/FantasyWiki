import { Team } from "../../../model";
import { TeamRepository } from "../repositories/teamRepository";
import { TeamRepositoryD1 } from "../repositories/d1/teamRepositoryD1";
import { Result, failure } from "../repositories/result";

export const STARTING_CREDITS = 1000;

export class TeamService {
  private repository: TeamRepository;

  constructor(repositoryOrDb: TeamRepository | D1Database) {
    if ("create" in repositoryOrDb) {
      this.repository = repositoryOrDb;
      return;
    }
    this.repository = new TeamRepositoryD1(repositoryOrDb);
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

    const existsResult = await this.repository.existsByNameInLeague(
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

    return this.repository.create({
      name: trimmed,
      playerId,
      leagueId,
      credits: STARTING_CREDITS,
    });
  }
}
