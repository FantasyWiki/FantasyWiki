import { Player, League } from "../../../../model";
import { PLAYER_ERRORS, PlayerRepository } from "../playerRepository";
import { Result, success, failure } from "../result";

/**
 * D1 surfaces a lost uniqueness constraint only as driver text, and it reaches
 * us either as a thrown error or as a failed `run()`. Recognising it is this
 * layer's job: the phrasing is SQLite's, so no other layer should ever see it.
 */
function isUsernameConflict(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return message.includes("UNIQUE constraint failed: players.username");
}

/** The driver's own message for a failed `run()`, which D1 types as `unknown`. */
function d1ErrorMessage(result: object): string {
  return "error" in result && typeof result.error === "string"
    ? result.error
    : "Unknown D1 error";
}

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
        return failure(
          `Failed to save google account: ${d1ErrorMessage(googleAccountResult)}`,
        );
      }

      // Insert player with reference to google_account
      const playerStmt = this.db
        .prepare(
          "INSERT INTO players (id, username, accountId) VALUES (?, ?, ?)",
        )
        .bind(playerId, player.username, player.accountId);
      const playerResult = await playerStmt.run();

      if (!playerResult.success) {
        const playerError = d1ErrorMessage(playerResult);
        return failure(
          isUsernameConflict(playerError)
            ? PLAYER_ERRORS.USERNAME_TAKEN
            : `Failed to save player: ${playerError}`,
        );
      }

      return success({ id: playerId, username: player.username });
    } catch (error) {
      if (isUsernameConflict(error)) {
        return failure(PLAYER_ERRORS.USERNAME_TAKEN);
      }
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
      return failure(PLAYER_ERRORS.NOT_FOUND);
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
      return failure(PLAYER_ERRORS.ACCOUNT_NOT_FOUND);
    } catch (error) {
      return failure(
        `Error retrieving player: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
