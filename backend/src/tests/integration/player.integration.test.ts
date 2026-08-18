import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import { PlayerService } from "../../services/player";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import {
  PLAYER_ERRORS,
  PlayerRepository,
} from "../../repositories/playerRepository";
import { success, unwrap } from "../../repositories/result";
import { TeamService } from "../../services/team";
import { anotherLeague } from "../support/subjects";
import { repositories } from "../support/target";

describe("PlayerService Integration Tests", () => {
  let playerService: PlayerService;

  beforeEach(() => {
    playerService = new PlayerService(repositories());
  });

  it("should use an injected repository when one is provided", async () => {
    const player = {
      id: "injected-1",
      username: "injected",
      email: "injected@example.com",
      accountId: "injected-account",
    };
    const repository: PlayerRepository = {
      save: async () => success(player),
      getById: async () => success(player),
      getLeaguesByPlayerId: async () => success([]),
      getPlayerByAccountId: async () => success(player),
    };
    const service = new PlayerService({ players: repository });

    const result = await service.createPlayer(
      "injected",
      "injected@example.com",
      "injected-account",
    );

    expect(result).toEqual(success(player));
  });

  describe("createPlayer", () => {
    it("should create a new player successfully", async () => {
      const result = await playerService.createPlayer(
        "testuser",
        "testuser@example.com",
        "account-id-1",
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBeDefined();
        expect(result.value.username).toBe("testuser");
      }
    });

    it("should fail when creating a player with duplicate username", async () => {
      await playerService.createPlayer(
        "duplicateuser",
        "duplicate@example.com",
        "account-id-2",
      );
      const result = await playerService.createPlayer(
        "duplicateuser",
        "duplicate2@example.com",
        "account-id-3",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(PLAYER_ERRORS.USERNAME_TAKEN);
      }
    });

    it("should generate unique IDs for multiple players", async () => {
      const result1 = await playerService.createPlayer(
        "user1",
        "user1@example.com",
        "account-id-4",
      );
      const result2 = await playerService.createPlayer(
        "user2",
        "user2@example.com",
        "account-id-5",
      );

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);

      if (result1.ok && result2.ok) {
        expect(result1.value.id).not.toBe(result2.value.id);
      }
    });
  });

  describe("getPlayerById", () => {
    it("should retrieve a player by ID", async () => {
      const createResult = await playerService.createPlayer(
        "retrievetest",
        "retrieve@example.com",
        "account-id-6",
      );
      expect(createResult.ok).toBe(true);

      if (createResult.ok) {
        const playerId = createResult.value.id;
        const getResult = await playerService.getPlayerById(playerId);

        expect(getResult.ok).toBe(true);
        if (getResult.ok) {
          expect(getResult.value.id).toBe(playerId);
          expect(getResult.value.username).toBe("retrievetest");
        }
      }
    });

    it("should return failure when player does not exist", async () => {
      const result = await playerService.getPlayerById("nonexistent-id");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(PLAYER_ERRORS.NOT_FOUND);
      }
    });

    it("should handle database errors gracefully", async () => {
      const result = await playerService.getPlayerById("");

      expect(result.ok).toBe(false);
    });
  });

  describe("getPlayerByGoogleAccountId", () => {
    it("should retrieve a player by Google account ID", async () => {
      const googleAccountId = "google-account-123";
      const createResult = await playerService.createPlayer(
        "googletest",
        "google@example.com",
        googleAccountId,
      );
      expect(createResult.ok).toBe(true);

      if (createResult.ok) {
        const playerId = createResult.value.id;
        const result =
          await playerService.getPlayerByGoogleAccountId(googleAccountId);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.id).toBe(playerId);
          expect(result.value.username).toBe("googletest");
        }
      }
    });

    it("should return failure when Google account does not exist", async () => {
      const result = await playerService.getPlayerByGoogleAccountId(
        "nonexistent-account",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(PLAYER_ERRORS.ACCOUNT_NOT_FOUND);
      }
    });
  });

  describe("getLeaguesByPlayerId", () => {
    it("should return the leagues the player has a team in", async () => {
      const created = await playerService.createPlayer(
        "leaguemember",
        "member@example.com",
        "account-leagues-1",
      );
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error("setup failed");

      unwrap(
        await new TeamService(repositories()).createTeam(
          created.value.id,
          GLOBAL_LEAGUE_ID,
          "Member FC",
        ),
        "team",
      );

      const result = await playerService.getLeaguesByPlayerId(created.value.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].id).toBe(GLOBAL_LEAGUE_ID);
        expect(result.value[0].name).toBe("Global League");
      }
    });

    it("should read the stored dates as instants, not as text", async () => {
      const created = await playerService.createPlayer(
        "datereader",
        "dates@example.com",
        "account-leagues-dates",
      );
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error("setup failed");

      unwrap(
        await repositories().teams.create({
          name: "Calendar FC",
          playerId: created.value.id,
          leagueId: GLOBAL_LEAGUE_ID,
        }),
        "team",
      );

      const result = await playerService.getLeaguesByPlayerId(created.value.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const { startDate, endDate } = result.value[0];
        // Stored as text, so the repository has to be the one that parses them:
        // anything downstream doing instant arithmetic (the league calendar)
        // would silently get a string instead.
        expect(startDate).toBeInstanceOf(Temporal.Instant);
        expect(endDate).toBeInstanceOf(Temporal.Instant);
        expect(startDate.toString()).toContain("2024-01-01");
      }
    });

    it("should list only the leagues the player has a team in", async () => {
      const me = await playerService.createPlayer(
        "counter",
        "counter@example.com",
        "account-leagues-count",
      );
      const outsider = await playerService.createPlayer(
        "outsider",
        "outsider@example.com",
        "account-leagues-outsider",
      );
      if (!me.ok || !outsider.ok) throw new Error("setup failed");

      const quiet = await anotherLeague();

      unwrap(
        await repositories().teams.create({
          name: "Mine FC",
          playerId: me.value.id,
          leagueId: GLOBAL_LEAGUE_ID,
        }),
        "my team",
      );
      // Somebody else's league, which must not leak into this player's list.
      unwrap(
        await repositories().teams.create({
          name: "Elsewhere FC",
          playerId: outsider.value.id,
          leagueId: quiet.id,
        }),
        "outsider team",
      );

      const result = await playerService.getLeaguesByPlayerId(me.value.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.map((l) => l.id)).toEqual([GLOBAL_LEAGUE_ID]);
      }
    });

    it("should return one row per league however many teams it holds", async () => {
      // The membership join is DISTINCT precisely so a crowded league does not
      // appear once per team in it.
      const me = await playerService.createPlayer(
        "dedup",
        "dedup@example.com",
        "account-leagues-dedup",
      );
      if (!me.ok) throw new Error("setup failed");

      unwrap(
        await repositories().teams.create({
          name: "Dedup FC",
          playerId: me.value.id,
          leagueId: GLOBAL_LEAGUE_ID,
        }),
        "my team",
      );
      for (const name of ["a", "b", "c"]) {
        const other = await playerService.createPlayer(
          `dedup-rival-${name}`,
          `dedup-${name}@example.com`,
          `account-dedup-${name}`,
        );
        if (!other.ok) throw new Error("setup failed");
        unwrap(
          await repositories().teams.create({
            name: `Rival ${name}`,
            playerId: other.value.id,
            leagueId: GLOBAL_LEAGUE_ID,
          }),
          "rival team",
        );
      }

      const result = await playerService.getLeaguesByPlayerId(me.value.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
      }
    });

    it("should return an empty list when the player has no teams", async () => {
      const created = await playerService.createPlayer(
        "loner",
        "loner@example.com",
        "account-leagues-2",
      );
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error("setup failed");

      const result = await playerService.getLeaguesByPlayerId(created.value.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });
  });
});
