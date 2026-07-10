import { Team } from "../../../../model";
import { STARTING_CREDITS } from "../../../../model/team";
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
  }): Promise<Result<Team>> {
    try {
      const id = crypto.randomUUID();

      const result = await this.db
        .prepare(
          "INSERT INTO teams (id, name, playerId, leagueId) VALUES (?, ?, ?, ?)",
        )
        .bind(id, team.name, team.playerId, team.leagueId)
        .run();

      if (!result.success) {
        const error =
          "error" in result && typeof result.error === "string"
            ? result.error
            : "Unknown D1 error";
        return failure(`Failed to create team: ${error}`);
      }

      // A brand-new team has zero contracts, so its derived credits is
      // trivially STARTING_CREDITS — no query needed.
      return success({
        id,
        name: team.name,
        playerId: team.playerId,
        leagueId: team.leagueId,
        credits: STARTING_CREDITS,
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

  async getByPlayerAndLeague(
    playerId: string,
    leagueId: string,
  ): Promise<Result<Team | null>> {
    try {
      // credits is derived from the contracts ledger, not stored: starting
      // budget minus everything ever spent, plus payouts from early sales.
      const result = await this.db
        .prepare(
          `SELECT t.id, t.name, t.playerId, t.leagueId,
                  ? - COALESCE(SUM(c.purchasePrice), 0)
                    + COALESCE(SUM(CASE WHEN c.settled = 1 THEN c.salePayout ELSE 0 END), 0) AS credits
           FROM teams t
           LEFT JOIN contracts c ON c.teamId = t.id
           WHERE t.playerId = ? AND t.leagueId = ?
           GROUP BY t.id, t.name, t.playerId, t.leagueId`,
        )
        .bind(STARTING_CREDITS, playerId, leagueId)
        .first<Team>();

      return success(result ?? null);
    } catch (error) {
      return failure(
        `Error fetching team: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
