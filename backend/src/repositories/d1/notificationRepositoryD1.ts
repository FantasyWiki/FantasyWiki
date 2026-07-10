import {
  NewNotification,
  NotificationRepository,
  NotificationRow,
  NOTIFICATION_ERRORS,
} from "../notificationRepository";
import { STARTING_CREDITS } from "../../../../model/team";
import { Result, success, failure } from "../result";

interface NotificationJoinRow {
  id: string;
  message: string;
  date: string;
  isRead: number;
  contractId: string;
  articleId: string;
  purchaseDate: string;
  expireDate: string;
  purchasePrice: number;
  teamId: string;
  teamName: string;
  credits: number;
  leagueId: string;
  playerId: string;
  playerName: string;
}

// credits is derived from the contracts ledger (see
// TeamRepositoryD1.getByPlayerAndLeague) via a CTE rather than a stored
// column. Its bind param (STARTING_CREDITS) must be the first `?` supplied by
// every caller of this fragment, before their own WHERE params.
const SELECT_NOTIFICATIONS = `
  WITH team_credits AS (
    SELECT teamId,
           ? - COALESCE(SUM(purchasePrice), 0)
             + COALESCE(SUM(CASE WHEN settled = 1 THEN salePayout ELSE 0 END), 0) AS credits
    FROM contracts
    GROUP BY teamId
  )
  SELECT n.id, n.message, n.date, n.isRead,
         c.id AS contractId, c.articleId, c.purchaseDate, c.expireDate, c.purchasePrice,
         t.id AS teamId, t.name AS teamName, tc.credits, t.leagueId,
         pl.id AS playerId, pl.username AS playerName
  FROM notifications n
  JOIN contracts c ON c.id = n.contractId
  JOIN teams t     ON t.id = c.teamId
  JOIN team_credits tc ON tc.teamId = t.id
  JOIN players pl  ON pl.id = t.playerId
`;

function toNotificationRow(row: NotificationJoinRow): NotificationRow {
  return { ...row, isRead: row.isRead === 1 };
}

export class NotificationRepositoryD1 implements NotificationRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getByPlayerAndLeague(
    playerId: string,
    leagueId: string,
  ): Promise<Result<NotificationRow[]>> {
    try {
      const result = await this.db
        .prepare(
          `${SELECT_NOTIFICATIONS} WHERE t.playerId = ? AND t.leagueId = ? ORDER BY n.date DESC`,
        )
        .bind(STARTING_CREDITS, playerId, leagueId)
        .all<NotificationJoinRow>();

      return success(result.results.map(toNotificationRow));
    } catch (error) {
      return failure(
        `Error fetching notifications: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getByPlayerId(playerId: string): Promise<Result<NotificationRow[]>> {
    try {
      const result = await this.db
        .prepare(
          `${SELECT_NOTIFICATIONS} WHERE t.playerId = ? ORDER BY n.date DESC`,
        )
        .bind(STARTING_CREDITS, playerId)
        .all<NotificationJoinRow>();

      return success(result.results.map(toNotificationRow));
    } catch (error) {
      return failure(
        `Error fetching notifications: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async markAsRead(id: string, playerId: string): Promise<Result<void>> {
    try {
      const result = await this.db
        .prepare(
          `UPDATE notifications SET isRead = 1
           WHERE id = ?
             AND contractId IN (
               SELECT c.id FROM contracts c
               JOIN teams t ON t.id = c.teamId
               WHERE t.playerId = ?
             )`,
        )
        .bind(id, playerId)
        .run();

      if (!result.success) {
        const error =
          "error" in result && typeof result.error === "string"
            ? result.error
            : "Unknown D1 error";
        return failure(`Failed to mark notification as read: ${error}`);
      }

      if (result.meta.changes === 0) {
        const exists = await this.db
          .prepare(`SELECT 1 FROM notifications WHERE id = ?`)
          .bind(id)
          .first();
        if (!exists) {
          return failure(NOTIFICATION_ERRORS.NOT_FOUND);
        }
        return failure(NOTIFICATION_ERRORS.NOT_AUTHORIZED);
      }

      return success(undefined);
    } catch (error) {
      return failure(
        `Error marking notification as read: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async create(notification: NewNotification): Promise<Result<void>> {
    try {
      const result = await this.db
        .prepare(
          `INSERT INTO notifications (id, contractId, message, date, isRead) VALUES (?, ?, ?, ?, 0)`,
        )
        .bind(
          notification.id,
          notification.contractId,
          notification.message,
          notification.date,
        )
        .run();

      if (!result.success) {
        return failure("Error creating notification");
      }
      return success(undefined);
    } catch (error) {
      return failure(
        `Error creating notification: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
