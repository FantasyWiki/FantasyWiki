import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import { NotificationService } from "../../services/notification";
import { PlayerService } from "../../services/player";
import { TeamService } from "../../services/team";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import { unwrap } from "../../repositories/result";
import { repositories, store } from "../support/target";

describe("NotificationService Integration Tests", () => {
  let notificationService: NotificationService;
  let playerService: PlayerService;
  let teamService: TeamService;
  let playerId: string;
  let teamId: string;

  /** A notification about a contract the given team holds. */
  async function notify(opts: {
    notificationId: string;
    teamId: string;
    articleId?: string;
    message?: string;
    date?: string;
  }): Promise<void> {
    const contract = unwrap(
      await repositories().contracts.create({
        teamId: opts.teamId,
        articleId: opts.articleId ?? "Cat",
        purchaseDate: Temporal.PlainDate.from("2026-01-01"),
        expireDate: Temporal.PlainDate.from("2026-01-08"),
        purchasePrice: 50,
      }),
      "contract",
    );

    unwrap(
      await repositories().notifications.create({
        id: opts.notificationId,
        contractId: contract.id,
        message: opts.message ?? "Test notification",
        date: opts.date ?? "2026-01-05",
      }),
      "notification",
    );
  }

  beforeEach(async () => {
    notificationService = new NotificationService(repositories());
    playerService = new PlayerService(repositories());
    teamService = new TeamService(repositories());

    playerId = unwrap(
      await playerService.createPlayer(
        "notifytester",
        "notifytester@example.com",
        "account-notify-1",
      ),
      "player",
    ).id;

    teamId = unwrap(
      await teamService.createTeam(playerId, GLOBAL_LEAGUE_ID, "Notify FC"),
      "team",
    ).id;
  });

  describe("getMyNotifications", () => {
    it("should return only notifications for the player's team in the specified league", async () => {
      const otherLeagueId = "league-notify-other";
      await store().createLeague({
        id: otherLeagueId,
        name: "Other Notify League",
        adminId: "system",
      });

      const otherPlayerId = unwrap(
        await playerService.createPlayer(
          "othernotify",
          "othernotify@example.com",
          "account-other-notify-1",
        ),
        "other player",
      ).id;
      const otherTeamId = unwrap(
        await teamService.createTeam(
          otherPlayerId,
          otherLeagueId,
          "Other Notify FC",
        ),
        "other team",
      ).id;

      await notify({
        notificationId: "notif-1",
        teamId,
        message: "Your contract is expiring",
      });
      // The other player's, which must not appear in our results.
      await notify({
        notificationId: "notif-other-1",
        teamId: otherTeamId,
        message: "Someone else's notification",
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
      const secondLeagueId = "league-notify-second";
      await store().createLeague({
        id: secondLeagueId,
        name: "Second Notify League",
        adminId: "system",
      });

      const secondTeamId = unwrap(
        await teamService.createTeam(
          playerId,
          secondLeagueId,
          "Second Notify FC",
        ),
        "second team",
      ).id;

      await notify({
        notificationId: "notif-all-1",
        teamId,
        message: "Global notification",
      });
      await notify({
        notificationId: "notif-all-2",
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
      await notify({ notificationId: "notif-read-1", teamId });

      const markResult = await notificationService.markAsRead(
        "notif-read-1",
        playerId,
      );
      expect(markResult.ok).toBe(true);

      const rows = unwrap(
        await repositories().notifications.getByPlayerId(playerId),
        "notification read-back",
      );
      expect(rows.find((row) => row.id === "notif-read-1")?.isRead).toBe(true);
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
      const otherPlayerId = unwrap(
        await playerService.createPlayer(
          "othernotifyread",
          "othernotifyread@example.com",
          "account-other-notify-read-1",
        ),
        "other player",
      ).id;
      const otherTeamId = unwrap(
        await teamService.createTeam(
          otherPlayerId,
          GLOBAL_LEAGUE_ID,
          "Other Read FC",
        ),
        "other team",
      ).id;

      await notify({
        notificationId: "notif-read-other-1",
        teamId: otherTeamId,
        message: "Another player's notification",
      });

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
