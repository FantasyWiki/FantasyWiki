import { Temporal } from "@js-temporal/polyfill";
import { League } from "../../../../model";
import { LEAGUE_ERRORS, LeagueRepository } from "../leagueRepository";
import { Result, success, failure } from "../result";

/**
 * A `leagues` row as SQLite hands it back: the dates are text, not instants.
 * Shared with `PlayerRepositoryD1`, which selects the same columns, so both
 * read the stored dates through the one conversion below.
 */
export interface LeagueRow {
  id: string;
  name: string;
  adminId: string;
  startDate: string;
  endDate: string;
  domain: string;
  icon: string;
}

export function toLeague(row: LeagueRow): League {
  return {
    ...row,
    startDate: Temporal.Instant.from(row.startDate),
    endDate: Temporal.Instant.from(row.endDate),
  };
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
        return failure(LEAGUE_ERRORS.NOT_FOUND);
      }

      return success(toLeague(result));
    } catch (error) {
      return failure(
        `Error retrieving league: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async countTeamsByLeague(
    leagueIds: readonly string[],
  ): Promise<Result<Record<string, number>>> {
    if (leagueIds.length === 0) return success({});
    try {
      const placeholders = leagueIds.map(() => "?").join(", ");
      const results = await this.db
        .prepare(
          `SELECT leagueId, COUNT(*) AS teamCount
           FROM teams
           WHERE leagueId IN (${placeholders})
           GROUP BY leagueId`,
        )
        .bind(...leagueIds)
        .all<{ leagueId: string; teamCount: number }>();

      // Seeded with zeros so a league nobody has joined answers 0 rather than
      // going missing: GROUP BY only returns the ids that have rows.
      const counts: Record<string, number> = Object.fromEntries(
        leagueIds.map((id) => [id, 0]),
      );
      for (const row of results.results ?? []) {
        counts[row.leagueId] = row.teamCount;
      }
      return success(counts);
    } catch (error) {
      return failure(
        `Error counting league teams: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
