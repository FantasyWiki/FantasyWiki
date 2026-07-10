import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect } from "vitest";
import {
  NotificationService,
  NotificationServiceDeps,
} from "../services/notification";
import {
  NotificationRepository,
  NotificationRow,
} from "../repositories/notificationRepository";
import { LeagueRepository } from "../repositories/leagueRepository";
import { success, failure } from "../repositories/result";
import type { League } from "../../../model";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const PLAYER_ID = "player-1";
const LEAGUE_ID = "league-global";
const TEAM_ID = "team-1";

const enLeague: League = {
  id: LEAGUE_ID,
  name: "Global League",
  adminId: "admin-1",
  startDate: Temporal.Instant.from("2026-01-01T00:00:00Z"),
  endDate: Temporal.Instant.from("2026-12-31T00:00:00Z"),
  domain: "en",
  icon: "🌍",
};

function makeRow(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: "notif-1",
    message: "Test notification",
    date: "2026-01-05",
    isRead: false,
    contractId: "contract-1",
    articleId: "Cat",
    purchaseDate: "2026-01-01",
    expireDate: "2026-01-08",
    purchasePrice: 50,
    teamId: TEAM_ID,
    teamName: "Test FC",
    credits: 1000,
    leagueId: LEAGUE_ID,
    playerId: PLAYER_ID,
    playerName: "testuser",
    ...overrides,
  };
}

// ─── Fake repo builders ──────────────────────────────────────────────────────

function makeNotificationRepo(
  rows: NotificationRow[] = [],
): NotificationRepository {
  return {
    getByPlayerAndLeague: async () => success(rows),
    getByPlayerId: async () => success(rows),
    markAsRead: async () => success(undefined),
    create: async () => success(undefined),
  };
}

function makeLeagueRepo(l: League = enLeague): LeagueRepository {
  return {
    getById: async () => success(l),
  };
}

function makeDeps(
  overrides: Partial<NotificationServiceDeps> = {},
): NotificationServiceDeps {
  return {
    notificationRepository: makeNotificationRepo(),
    leagueRepository: makeLeagueRepo(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("NotificationService (unit)", () => {
  describe("getMyNotifications", () => {
    it("returns an empty array when there are no notifications", async () => {
      const service = new NotificationService(makeDeps());
      const result = await service.getMyNotifications(PLAYER_ID, LEAGUE_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual([]);
    });

    it("maps a notification row to the correct RawNotification shape", async () => {
      const row = makeRow();
      const service = new NotificationService(
        makeDeps({ notificationRepository: makeNotificationRepo([row]) }),
      );

      const result = await service.getMyNotifications(PLAYER_ID, LEAGUE_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value).toHaveLength(1);
      const notif = result.value[0];
      expect(notif.id).toBe("notif-1");
      expect(notif.leagueId).toBe(LEAGUE_ID);
      expect(notif.message).toBe("Test notification");
      expect(notif.date).toBe("2026-01-05");
      expect(notif.isRead).toBe(false);
      // Contract shape
      expect(notif.contract.id).toBe("contract-1");
      expect(notif.contract.article.id).toBe("Cat");
      expect(notif.contract.article.domain).toBe("en");
      expect(notif.contract.team.id).toBe(TEAM_ID);
      expect(notif.contract.team.name).toBe("Test FC");
      expect(notif.contract.team.credits).toBe(1000);
      expect(notif.contract.team.player.id).toBe(PLAYER_ID);
      expect(notif.contract.team.player.name).toBe("testuser");
      expect(notif.contract.purchasePrice).toBe(50);
    });

    it("resolves the domain per league — uses 'it' domain for an Italian league", async () => {
      const itLeague: League = { ...enLeague, id: "league-it", domain: "it" };
      const row = makeRow({ leagueId: "league-it" });

      const service = new NotificationService(
        makeDeps({
          notificationRepository: makeNotificationRepo([row]),
          leagueRepository: { getById: async () => success(itLeague) },
        }),
      );

      const result = await service.getMyNotifications(PLAYER_ID, "league-it");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value[0].contract.article.domain).toBe("it");
    });

    it("resolves the correct domain for each league when notifications span multiple leagues", async () => {
      const enRow = makeRow({ id: "notif-en", leagueId: "league-en" });
      const itRow = makeRow({
        id: "notif-it",
        leagueId: "league-it",
        articleId: "Gatto",
      });

      const enLeagueObj: League = {
        ...enLeague,
        id: "league-en",
        domain: "en",
      };
      const itLeagueObj: League = {
        ...enLeague,
        id: "league-it",
        domain: "it",
      };

      const leagueRepo: LeagueRepository = {
        getById: async (id) => {
          if (id === "league-en") return success(enLeagueObj);
          if (id === "league-it") return success(itLeagueObj);
          return failure(`Unknown league: ${id}`);
        },
      };

      const service = new NotificationService(
        makeDeps({
          notificationRepository: {
            getByPlayerAndLeague: async () => success([enRow, itRow]),
            getByPlayerId: async () => success([enRow, itRow]),
            markAsRead: async () => success(undefined),
            create: async () => success(undefined),
          },
          leagueRepository: leagueRepo,
        }),
      );

      const result = await service.getAllForPlayer(PLAYER_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const byId = new Map(result.value.map((n) => [n.id, n]));
      expect(byId.get("notif-en")!.contract.article.domain).toBe("en");
      expect(byId.get("notif-it")!.contract.article.domain).toBe("it");
    });

    it("returns a failure when the notification repo fails", async () => {
      const service = new NotificationService(
        makeDeps({
          notificationRepository: {
            getByPlayerAndLeague: async () => failure("db error"),
            getByPlayerId: async () => failure("db error"),
            markAsRead: async () => failure("unused"),
            create: async () => failure("unused"),
          },
        }),
      );

      const result = await service.getMyNotifications(PLAYER_ID, LEAGUE_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("db error");
    });

    it("returns a failure when the league repo fails during domain resolution", async () => {
      const row = makeRow();
      const service = new NotificationService(
        makeDeps({
          notificationRepository: makeNotificationRepo([row]),
          leagueRepository: {
            getById: async () => failure("league not found"),
          },
        }),
      );

      const result = await service.getMyNotifications(PLAYER_ID, LEAGUE_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("league not found");
    });
  });

  describe("getAllForPlayer", () => {
    it("returns all notifications across leagues for the player", async () => {
      const row1 = makeRow({ id: "notif-1", leagueId: LEAGUE_ID });
      const row2 = makeRow({
        id: "notif-2",
        leagueId: LEAGUE_ID,
        contractId: "contract-2",
      });

      const service = new NotificationService(
        makeDeps({
          notificationRepository: makeNotificationRepo([row1, row2]),
        }),
      );

      const result = await service.getAllForPlayer(PLAYER_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(2);
      const ids = result.value.map((n) => n.id);
      expect(ids).toContain("notif-1");
      expect(ids).toContain("notif-2");
    });
  });

  describe("markAsRead", () => {
    it("delegates to the repository and returns success", async () => {
      let markedId: string | undefined;
      let markedPlayer: string | undefined;

      const service = new NotificationService(
        makeDeps({
          notificationRepository: {
            getByPlayerAndLeague: async () => success([]),
            getByPlayerId: async () => success([]),
            markAsRead: async (id, playerId) => {
              markedId = id;
              markedPlayer = playerId;
              return success(undefined);
            },
            create: async () => success(undefined),
          },
        }),
      );

      const result = await service.markAsRead("notif-42", PLAYER_ID);
      expect(result.ok).toBe(true);
      expect(markedId).toBe("notif-42");
      expect(markedPlayer).toBe(PLAYER_ID);
    });

    it("propagates a failure from the repository", async () => {
      const service = new NotificationService(
        makeDeps({
          notificationRepository: {
            getByPlayerAndLeague: async () => success([]),
            getByPlayerId: async () => success([]),
            markAsRead: async () => failure("not found"),
            create: async () => success(undefined),
          },
        }),
      );

      const result = await service.markAsRead("nonexistent", PLAYER_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("not found");
    });
  });
});
