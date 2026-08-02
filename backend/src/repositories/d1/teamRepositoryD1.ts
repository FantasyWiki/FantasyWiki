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
      // credits is derived from the contracts ledger, not stored. The
      // derivation itself lives in the team_credits view (migration 0006, ADR
      // 0007) — the one place it is written in SQL — and every team has a row
      // there, so this is a plain JOIN with no fallback.
      //
      // Filtered on the view's own playerId/leagueId, not on the joined teams
      // row: the view is inlined and recomputed per statement, and SQLite only
      // pushes a constraint down into its aggregate when the constraint names
      // the view's GROUP BY columns. Written this way it seeks one team via
      // UNIQUE (playerId, leagueId) and sums only that team's contracts;
      // written as `WHERE t.playerId = ?` it would aggregate every team in the
      // database on every dashboard load.
      const result = await this.db
        .prepare(
          `SELECT t.id, t.name, t.playerId, t.leagueId, tc.credits
           FROM team_credits tc
           JOIN teams t ON t.id = tc.teamId
           WHERE tc.playerId = ? AND tc.leagueId = ?`,
        )
        .bind(playerId, leagueId)
        .first<Team>();

      return success(result ?? null);
    } catch (error) {
      return failure(
        `Error fetching team: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
