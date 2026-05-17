import { Player, League } from "../../../../model";
import { PlayerRepository } from "../playerRepository";
import { Result, success, failure } from "../result";

export class PlayerRepositoryD1 implements PlayerRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async save(player: {
    username: string;
    accountId: string;
    email: string;
  }): Promise<Result<Player>> {
    try {
      const playerId = crypto.randomUUID();

      // Insert google_account first (it must exist before player references it)
      // Use INSERT OR IGNORE in case retry with same accountId but different username
      const googleAccountStmt = this.db
        .prepare(
          "INSERT OR IGNORE INTO google_accounts (id, googleId, email) VALUES (?, ?, ?)",
        )
        .bind(player.accountId, player.accountId, player.email);
      const googleAccountResult = await googleAccountStmt.run();

      if (!googleAccountResult.success) {
        const googleAccountError =
          "error" in googleAccountResult &&
          typeof googleAccountResult.error === "string"
            ? googleAccountResult.error
            : "Unknown D1 error";
        return failure(`Failed to save google account: ${googleAccountError}`);
      }

      // Insert player with reference to google_account
      const playerStmt = this.db
        .prepare(
          "INSERT INTO players (id, username, accountId) VALUES (?, ?, ?)",
        )
        .bind(playerId, player.username, player.accountId);
      const playerResult = await playerStmt.run();

      if (!playerResult.success) {
        const playerError =
          "error" in playerResult && typeof playerResult.error === "string"
            ? playerResult.error
            : "Unknown D1 error";
        return failure(`Failed to save player: ${playerError}`);
      }

      return success({ id: playerId, username: player.username });
    } catch (error) {
      return failure(
        `Error saving player: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getById(id: string): Promise<Result<Player>> {
    try {
      const result = await this.db
        .prepare("SELECT id, username FROM players WHERE id = ?")
        .bind(id)
        .first<Player>();

      if (result) {
        return success(result);
      }
      return failure(`Player with id ${id} not found`);
    } catch (error) {
      return failure(
        `Error retrieving player: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getLeaguesByPlayerId(id: string): Promise<Result<League[]>> {
    try {
      const results = await this.db
        .prepare(
          `
                    SELECT DISTINCT l.id, l.name, l.adminId, l.startDate, l.endDate, l.domain, l.icon
                    FROM leagues l
                    INNER JOIN teams t ON l.id = t.leagueId
                    WHERE t.playerId = ?
                `,
        )
        .bind(id)
        .all<League>();

      if (results.results) {
        return success(results.results);
      }
      return success([]);
    } catch (error) {
      return failure(
        `Error retrieving leagues: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getPlayerByAccountId(accountId: string): Promise<Result<Player>> {
    try {
      const result = await this.db
        .prepare(
          `
                    SELECT p.id, p.username
                    FROM players p
                    WHERE p.accountId = ?
                `,
        )
        .bind(accountId)
        .first<Player>();

      if (result) {
        return success(result);
      }
      return failure(`Player with account id ${accountId} not found`);
    } catch (error) {
      return failure(
        `Error retrieving player: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
