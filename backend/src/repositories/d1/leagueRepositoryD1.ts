import { Temporal } from "@js-temporal/polyfill";
import { League } from "../../../../model";
import { LeagueRepository } from "../leagueRepository";
import { Result, success, failure } from "../result";

interface LeagueRow {
  id: string;
  name: string;
  adminId: string;
  startDate: string;
  endDate: string;
  domain: string;
  icon: string;
}

export class LeagueRepositoryD1 implements LeagueRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getById(id: string): Promise<Result<League>> {
    try {
      const result = await this.db
        .prepare(
          "SELECT id, name, adminId, startDate, endDate, domain, icon FROM leagues WHERE id = ?",
        )
        .bind(id)
        .first<LeagueRow>();

      if (!result) {
        return failure(`League with id ${id} not found`);
      }

      return success({
        ...result,
        startDate: Temporal.Instant.from(result.startDate),
        endDate: Temporal.Instant.from(result.endDate),
      });
    } catch (error) {
      return failure(
        `Error retrieving league: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
