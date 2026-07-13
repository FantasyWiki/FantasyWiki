import { Temporal } from "@js-temporal/polyfill";
import { Result, success, failure } from "../result";
import type {
  ScoringRepository,
  TeamLineupRow,
  ActiveContractRow,
} from "../scoringRepository";

export class ScoringRepositoryD1 implements ScoringRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getTeamLineups(): Promise<Result<TeamLineupRow[]>> {
    try {
      // Only teams that have set a lineup are scorable; the INNER JOIN drops
      // teams with no formation yet (they have nothing to score).
      const result = await this.db
        .prepare(
          `SELECT t.id AS teamId, t.leagueId AS leagueId, l.domain AS domain,
                  li.schema AS schema, li.formation AS formation
           FROM teams t
           JOIN leagues l ON l.id = t.leagueId
           JOIN lineups li ON li.teamId = t.id`,
        )
        .all<TeamLineupRow>();
      return success(result.results);
    } catch (error) {
      return failure(
        `Error fetching team lineups: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getActiveContracts(
    date: Temporal.PlainDate,
  ): Promise<Result<ActiveContractRow[]>> {
    try {
      // "Active on day D": owned (not settled), and D falls within the held
      // term. purchaseDate/expireDate are stored as 'YYYY-MM-DD' (Temporal
      // PlainDate), so lexicographic comparison against D is chronological.
      const day = date.toString();
      const result = await this.db
        .prepare(
          `SELECT id, teamId, articleId FROM contracts
           WHERE settled = 0 AND purchaseDate <= ? AND expireDate > ?`,
        )
        .bind(day, day)
        .all<ActiveContractRow>();
      return success(result.results);
    } catch (error) {
      return failure(
        `Error fetching active contracts: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
