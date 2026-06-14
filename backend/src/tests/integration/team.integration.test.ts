import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import { TeamService } from "../../services/team";
import { PlayerService } from "../../services/player";

describe("TeamService Integration Tests", () => {
  let teamService: TeamService;
  let playerService: PlayerService;
  let leagueId: string;
  let playerId: string;

  beforeEach(async () => {
    teamService = new TeamService(env.db);
    playerService = new PlayerService(env.db);

    const playerResult = await playerService.createPlayer(
      "leagueadmin",
      "leagueadmin@example.com",
      "account-id-league-admin",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed");
    playerId = playerResult.value.id;

    leagueId = "league-1";
    await env.db
      .prepare(
        `INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        leagueId,
        "Test League",
        playerId,
        new Date().toISOString(),
        new Date().toISOString(),
        "en",
        "🌍",
      )
      .run();
  });

  describe("createTeam", () => {
    it("should create a new team successfully", async () => {
      const result = await teamService.createTeam(
        playerId,
        leagueId,
        "The Wiki Wizards",
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBeDefined();
        expect(result.value.name).toBe("The Wiki Wizards");
        expect(result.value.playerId).toBe(playerId);
        expect(result.value.leagueId).toBe(leagueId);
        expect(result.value.credits).toBe(1000);
      }
    });

    it("should trim whitespace from the team name", async () => {
      const result = await teamService.createTeam(
        playerId,
        leagueId,
        "  Padded Name  ",
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe("Padded Name");
      }
    });

    it("should fail when the name is shorter than 3 characters", async () => {
      const result = await teamService.createTeam(playerId, leagueId, "ab");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("between 3 and 30 characters");
      }
    });

    it("should fail when the name is longer than 30 characters", async () => {
      const result = await teamService.createTeam(
        playerId,
        leagueId,
        "a".repeat(31),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("between 3 and 30 characters");
      }
    });

    it("should fail when the team name is already taken in the league", async () => {
      const firstResult = await teamService.createTeam(
        playerId,
        leagueId,
        "The Champions",
      );
      expect(firstResult.ok).toBe(true);

      const secondPlayerResult = await playerService.createPlayer(
        "anotherplayer",
        "anotherplayer@example.com",
        "account-id-another-player",
      );
      expect(secondPlayerResult.ok).toBe(true);
      if (!secondPlayerResult.ok) throw new Error("setup failed");

      const result = await teamService.createTeam(
        secondPlayerResult.value.id,
        leagueId,
        "the champions",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("already taken");
      }
    });

    it("should allow the same team name in different leagues", async () => {
      const otherLeagueId = "league-2";
      await env.db
        .prepare(
          `INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          otherLeagueId,
          "Other League",
          playerId,
          new Date().toISOString(),
          new Date().toISOString(),
          "en",
          "🌍",
        )
        .run();

      const firstResult = await teamService.createTeam(
        playerId,
        leagueId,
        "Shared Name",
      );
      expect(firstResult.ok).toBe(true);

      const secondResult = await teamService.createTeam(
        playerId,
        otherLeagueId,
        "Shared Name",
      );
      expect(secondResult.ok).toBe(true);
    });
  });
});
