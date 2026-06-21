import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import { LoginService } from "../../services/login";

describe("LoginService Integration Tests", () => {
  let loginService: LoginService;

  beforeEach(() => {
    loginService = new LoginService(env.db);
  });

  describe("loginWithGoogleAccount", () => {
    it("should return existing player if player already exists", async () => {
      const googleAccountId = "google-123";
      const email = "existing@example.com";

      // First login - creates player
      const firstLogin = await loginService.loginWithGoogleAccount(
        googleAccountId,
        email,
      );
      expect(firstLogin.ok).toBe(true);

      if (firstLogin.ok) {
        expect(firstLogin.value.isNew).toBe(true);
        const firstPlayerId = firstLogin.value.player.id;
        const firstUsername = firstLogin.value.player.username;

        // Second login - should return same player
        const secondLogin = await loginService.loginWithGoogleAccount(
          googleAccountId,
          email,
        );
        expect(secondLogin.ok).toBe(true);

        if (secondLogin.ok) {
          expect(secondLogin.value.isNew).toBe(false);
          expect(secondLogin.value.player.id).toBe(firstPlayerId);
          expect(secondLogin.value.player.username).toBe(firstUsername);
        }
      }
    });

    it("should create player on first login with email local-part as username", async () => {
      const googleAccountId = "google-456";
      const email = "newuser@example.com";

      const result = await loginService.loginWithGoogleAccount(
        googleAccountId,
        email,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isNew).toBe(true);
        expect(result.value.player.id).toBeDefined();
        expect(result.value.player.username).toBe("newuser");
      }
    });

    it("should generate username with numeric suffix on duplicate", async () => {
      const email1 = "duplicate@example.com";
      const email2 = "duplicate@gmail.com";

      // Create first player - username will be "duplicate"
      const login1 = await loginService.loginWithGoogleAccount(
        "google-001",
        email1,
      );
      expect(login1.ok).toBe(true);

      if (login1.ok) {
        expect(login1.value.player.username).toBe("duplicate");
      }

      // Create second player with same local-part
      // Should get "duplicate1" or similar suffix
      const login2 = await loginService.loginWithGoogleAccount(
        "google-002",
        email2,
      );
      expect(login2.ok).toBe(true);

      if (login2.ok) {
        expect(login2.value.player.username).toBe("duplicate1");
      }
    });

    it("should extract correct username from email variations", async () => {
      const testCases = [
        { email: "john.doe@example.com", expectedUsername: "john.doe" },
        { email: "alice+tag@example.com", expectedUsername: "alice+tag" },
        { email: "simple@example.com", expectedUsername: "simple" },
      ];

      for (const testCase of testCases) {
        const result = await loginService.loginWithGoogleAccount(
          `google-${testCase.email}`,
          testCase.email,
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.player.username).toBe(testCase.expectedUsername);
        }
      }
    });

    it("should handle multiple logins with different Google accounts", async () => {
      const user1 = await loginService.loginWithGoogleAccount(
        "google-user-1",
        "user1@example.com",
      );
      const user2 = await loginService.loginWithGoogleAccount(
        "google-user-2",
        "user2@example.com",
      );

      expect(user1.ok).toBe(true);
      expect(user2.ok).toBe(true);

      if (user1.ok && user2.ok) {
        expect(user1.value.player.id).not.toBe(user2.value.player.id);
        expect(user1.value.player.username).not.toBe(
          user2.value.player.username,
        );
      }
    });

    it("should return lookup errors that are not not-found without creating a user", async () => {
      let createCalled = false;
      const lookupError = "Error retrieving player: database unavailable";
      const mockedService = {
        getPlayerByGoogleAccountId: async () =>
          ({ ok: false, error: lookupError }) as const,
        createPlayer: async () => {
          createCalled = true;
          return {
            ok: true as const,
            value: { id: "new-id", username: "newuser" },
          };
        },
      };
      const service = new LoginService(env.db, mockedService);

      const result = await service.loginWithGoogleAccount(
        "google-user-error",
        "error@example.com",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(lookupError);
      }
      expect(createCalled).toBe(false);
    });
  });
});
