import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import { NotificationService } from "../../services/notification";
import { PlayerService } from "../../services/player";
import { GLOBAL_LEAGUE_ID } from "../../services/league";

describe("NotificationService Integration Tests", () => {
  let notificationService: NotificationService;
  let playerService: PlayerService;
  let playerId: string;
  let teamId: string;

  beforeEach(async () => {
    notificationService = new NotificationService(env.db);
    playerService = new PlayerService(env.db);

    const playerResult = await playerService.createPlayer(
      "notifytester",
      "notifytester@example.com",
      "account-notify-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    teamId = "team-notify-1";
    await env.db
      .prepare(
        "INSERT INTO teams (id, name, playerId, leagueId, credits) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(teamId, "Notify FC", playerId, GLOBAL_LEAGUE_ID, 1000)
      .run();
  });

  // Helper: insert a contract then a notification referencing it
  async function insertNotification(opts: {
    notificationId: string;
    contractId: string;
    teamId: string;
    articleId?: string;
    message?: string;
    date?: string;
    isRead?: number;
  }): Promise<void> {
    const articleId = opts.articleId ?? "Cat";
    await env.db
      .prepare(
        "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        opts.contractId,
        opts.teamId,
        articleId,
        "2026-01-01",
        "2026-01-08",
        50,
      )
      .run();

    await env.db
      .prepare(
        "INSERT INTO notifications (id, contractId, message, date, isRead) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(
        opts.notificationId,
        opts.contractId,
        opts.message ?? "Test notification",
        opts.date ?? "2026-01-05",
        opts.isRead ?? 0,
      )
      .run();
  }

  describe("getMyNotifications", () => {
    it("should return only notifications for the player's team in the specified league", async () => {
      // Insert a second player and team so we can confirm isolation
      const otherLeagueId = "league-notify-other";
      await env.db
        .prepare(
          "INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          otherLeagueId,
          "Other Notify League",
          "system",
          new Date().toISOString(),
          new Date().toISOString(),
          "en",
          "🌍",
        )
        .run();

      const otherPlayerResult = await playerService.createPlayer(
        "othernotify",
        "othernotify@example.com",
        "account-other-notify-1",
      );
      expect(otherPlayerResult.ok).toBe(true);
      if (!otherPlayerResult.ok) throw new Error("setup failed");
      const otherPlayerId = otherPlayerResult.value.id;

      const otherTeamId = "team-notify-other-1";
      await env.db
        .prepare(
          "INSERT INTO teams (id, name, playerId, leagueId, credits) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(
          otherTeamId,
          "Other Notify FC",
          otherPlayerId,
          otherLeagueId,
          1000,
        )
        .run();

      // Notification for our player's team in global league
      await insertNotification({
        notificationId: "notif-1",
        contractId: "contract-notif-1",
        teamId,
        message: "Your contract is expiring",
        date: "2026-01-05",
      });

      // Notification for the other player's team — should NOT appear in our results
      await insertNotification({
        notificationId: "notif-other-1",
        contractId: "contract-notif-other-1",
        teamId: otherTeamId,
        message: "Someone else's notification",
        date: "2026-01-05",
      });

      const result = await notificationService.getMyNotifications(
        playerId,
        GLOBAL_LEAGUE_ID,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value).toHaveLength(1);
      expect(result.value[0].id).toBe("notif-1");
      expect(result.value[0].leagueId).toBe(GLOBAL_LEAGUE_ID);
      expect(result.value[0].message).toBe("Your contract is expiring");
    });

    it("should return an empty array when the player has no notifications in the league", async () => {
      const result = await notificationService.getMyNotifications(
        playerId,
        GLOBAL_LEAGUE_ID,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });
  });

  describe("getAllForPlayer", () => {
    it("should return notifications across all leagues for the player", async () => {
      // Create a second league and team for the same player
      const secondLeagueId = "league-notify-second";
      await env.db
        .prepare(
          "INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          secondLeagueId,
          "Second Notify League",
          "system",
          new Date().toISOString(),
          new Date().toISOString(),
          "en",
          "🌍",
        )
        .run();

      const secondTeamId = "team-notify-second-1";
      await env.db
        .prepare(
          "INSERT INTO teams (id, name, playerId, leagueId, credits) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(secondTeamId, "Second Notify FC", playerId, secondLeagueId, 1000)
        .run();

      // Notification in global league
      await insertNotification({
        notificationId: "notif-all-1",
        contractId: "contract-all-1",
        teamId,
        message: "Global notification",
        date: "2026-01-05",
      });

      // Notification in second league
      await insertNotification({
        notificationId: "notif-all-2",
        contractId: "contract-all-2",
        teamId: secondTeamId,
        message: "Second league notification",
        date: "2026-01-06",
      });

      const result = await notificationService.getAllForPlayer(playerId);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const ids = result.value.map((n) => n.id);
      expect(ids).toContain("notif-all-1");
      expect(ids).toContain("notif-all-2");
      expect(result.value).toHaveLength(2);
    });
  });

  describe("markAsRead", () => {
    it("should flip isRead to true for an existing notification", async () => {
      await insertNotification({
        notificationId: "notif-read-1",
        contractId: "contract-read-1",
        teamId,
        message: "Mark me read",
        date: "2026-01-05",
        isRead: 0,
      });

      const markResult = await notificationService.markAsRead(
        "notif-read-1",
        playerId,
      );
      expect(markResult.ok).toBe(true);

      // Verify directly in DB that isRead is now 1
      const row = await env.db
        .prepare("SELECT isRead FROM notifications WHERE id = ?")
        .bind("notif-read-1")
        .first<{ isRead: number }>();

      expect(row).not.toBeNull();
      expect(row!.isRead).toBe(1);
    });

    it("should return a failure when the notification ID does not exist", async () => {
      const result = await notificationService.markAsRead(
        "nonexistent-notification-id",
        playerId,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.toLowerCase()).toContain("not found");
      }
    });

    it("should return a failure when the notification exists but belongs to another player", async () => {
      // Create a second player with their own team and notification
      const otherPlayerResult = await playerService.createPlayer(
        "othernotifyread",
        "othernotifyread@example.com",
        "account-other-notify-read-1",
      );
      expect(otherPlayerResult.ok).toBe(true);
      if (!otherPlayerResult.ok) throw new Error("setup failed: other player");
      const otherPlayerId = otherPlayerResult.value.id;

      const otherTeamId = "team-notify-read-other-1";
      await env.db
        .prepare(
          "INSERT INTO teams (id, name, playerId, leagueId, credits) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(
          otherTeamId,
          "Other Read FC",
          otherPlayerId,
          GLOBAL_LEAGUE_ID,
          1000,
        )
        .run();

      // Insert notification belonging to the other player's team
      await insertNotification({
        notificationId: "notif-read-other-1",
        contractId: "contract-read-other-1",
        teamId: otherTeamId,
        message: "Another player's notification",
        date: "2026-01-05",
        isRead: 0,
      });

      // Attempt to mark it as read using the first player's ID — should be rejected
      const result = await notificationService.markAsRead(
        "notif-read-other-1",
        playerId,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.toLowerCase()).toContain("not authorized");
      }
    });
  });
});
