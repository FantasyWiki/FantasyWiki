import { Lineup } from "../../../../model";
import { LineupRepository } from "../lineupRepository";
import { Result, success, failure } from "../result";

export class LineupRepositoryD1 implements LineupRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getByTeamId(teamId: string): Promise<Result<Lineup | null>> {
    try {
      const result = await this.db
        .prepare("SELECT * FROM lineups WHERE teamId = ? LIMIT 1")
        .bind(teamId)
        .first<Lineup>();

      return success(result ?? null);
    } catch (error) {
      return failure(
        `Error fetching lineup: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async upsert(data: {
    teamId: string;
    schema: string;
    formation: string;
    updatedAt: string;
  }): Promise<Result<void>> {
    try {
      const result = await this.db
        .prepare(
          "INSERT OR REPLACE INTO lineups (teamId, schema, formation, updatedAt) VALUES (?, ?, ?, ?)",
        )
        .bind(data.teamId, data.schema, data.formation, data.updatedAt)
        .run();

      if (!result.success) {
        const error = result.error ?? "Unknown D1 error";
        return failure(`Failed to upsert lineup: ${error}`);
      }

      return success(undefined);
    } catch (error) {
      return failure(
        `Error upserting lineup: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
