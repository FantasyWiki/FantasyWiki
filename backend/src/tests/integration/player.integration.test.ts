import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import { PlayerService } from "../../services/player";

describe("PlayerService Integration Tests", () => {
  let playerService: PlayerService;

  beforeEach(() => {
    playerService = new PlayerService(env.db);
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
        expect(result.error).toContain("Error saving player");
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
        expect(result.error).toContain("not found");
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
        expect(result.error).toContain("not found");
      }
    });
  });
});
