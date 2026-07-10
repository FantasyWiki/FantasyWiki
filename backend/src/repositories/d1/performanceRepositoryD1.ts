import { Performance } from "../../../../model";
import { STARTING_CREDITS } from "../../../../model/team";
import { Result, success, failure } from "../result";
import type {
  PerformanceRepository,
  TeamCumulative,
} from "../performanceRepository";

export class PerformanceRepositoryD1 implements PerformanceRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getRecentByTeam(
    teamId: string,
    limit: number,
  ): Promise<Result<Performance[]>> {
    try {
      const result = await this.db
        .prepare(
          "SELECT * FROM performances WHERE teamId = ? ORDER BY date DESC LIMIT ?",
        )
        .bind(teamId, limit)
        .all<Performance>();

      return success(result.results);
    } catch (error) {
      return failure(
        `Error fetching recent performances: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getLeagueCumulatives(
    leagueId: string,
  ): Promise<Result<TeamCumulative[]>> {
    try {
      // teamCredits is derived from the contracts ledger (see
      // TeamRepositoryD1.getByPlayerAndLeague) via a CTE rather than a stored
      // column.
      const latestRows = await this.db
        .prepare(
          `WITH team_credits AS (
             SELECT teamId,
                    ? - COALESCE(SUM(purchasePrice), 0)
                      + COALESCE(SUM(CASE WHEN settled = 1 THEN salePayout ELSE 0 END), 0) AS credits
             FROM contracts
             GROUP BY teamId
           )
           SELECT t.id AS teamId, t.name AS teamName, COALESCE(tc.credits, ?) AS teamCredits,
                  pl.id AS playerId, pl.username AS playerName,
                  COALESCE(SUM(p.points), 0) AS total
           FROM teams t
           JOIN players pl ON pl.id = t.playerId
           LEFT JOIN team_credits tc ON tc.teamId = t.id
           LEFT JOIN performances p ON p.teamId = t.id
           WHERE t.leagueId = ?
           GROUP BY t.id, t.name, tc.credits, pl.id, pl.username`,
        )
        .bind(STARTING_CREDITS, STARTING_CREDITS, leagueId)
        .all<{
          teamId: string;
          teamName: string;
          teamCredits: number;
          playerId: string;
          playerName: string;
          total: number;
        }>();

      const previousRows = await this.db
        .prepare(
          `SELECT t.id AS teamId,
                  COALESCE(SUM(p.points), 0) AS total
           FROM teams t
           LEFT JOIN performances p ON p.teamId = t.id
             AND p.date < (SELECT MAX(date) FROM performances WHERE teamId = t.id)
           WHERE t.leagueId = ?
           GROUP BY t.id`,
        )
        .bind(leagueId)
        .all<{ teamId: string; total: number }>();

      const previousByTeam = new Map(
        previousRows.results.map((r) => [r.teamId, r.total]),
      );

      const result: TeamCumulative[] = latestRows.results.map((r) => ({
        teamId: r.teamId,
        teamName: r.teamName,
        teamCredits: r.teamCredits,
        playerId: r.playerId,
        playerName: r.playerName,
        cumulativeLatest: r.total,
        cumulativePrevious: previousByTeam.get(r.teamId) ?? 0,
      }));

      return success(result);
    } catch (error) {
      return failure(
        `Error fetching league cumulatives: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
