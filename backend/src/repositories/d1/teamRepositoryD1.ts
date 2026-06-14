import { Team } from "../../../../model";
import { TeamRepository } from "../teamRepository";
import { Result, success, failure } from "../result";

export class TeamRepositoryD1 implements TeamRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async create(team: {
    name: string;
    playerId: string;
    leagueId: string;
    credits: number;
  }): Promise<Result<Team>> {
    try {
      const id = crypto.randomUUID();

      const result = await this.db
        .prepare(
          "INSERT INTO teams (id, name, playerId, leagueId, credits) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(id, team.name, team.playerId, team.leagueId, team.credits)
        .run();

      if (!result.success) {
        const error =
          "error" in result && typeof result.error === "string"
            ? result.error
            : "Unknown D1 error";
        return failure(`Failed to create team: ${error}`);
      }

      return success({
        id,
        name: team.name,
        playerId: team.playerId,
        leagueId: team.leagueId,
        credits: team.credits,
      });
    } catch (error) {
      return failure(
        `Error creating team: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async existsByNameInLeague(
    name: string,
    leagueId: string,
  ): Promise<Result<boolean>> {
    try {
      const result = await this.db
        .prepare(
          "SELECT 1 FROM teams WHERE leagueId = ? AND LOWER(name) = LOWER(?)",
        )
        .bind(leagueId, name)
        .first();

      return success(result !== null);
    } catch (error) {
      return failure(
        `Error checking team name: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
