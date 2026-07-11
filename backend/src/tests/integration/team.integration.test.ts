import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import { TeamService } from "../../services/team";
import { PlayerService } from "../../services/player";
import { TeamRepositoryD1 } from "../../repositories/d1/teamRepositoryD1";
import type { TeamRepository } from "../../repositories/teamRepository";
import { success, failure } from "../../repositories/result";
import { STARTING_CREDITS } from "../../../../model/team";
import type { Team } from "../../../../model";

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
        expect(result.value.credits).toBe(STARTING_CREDITS);
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

    it("should fail when the player already has a team in this league", async () => {
      const firstResult = await teamService.createTeam(
        playerId,
        leagueId,
        "First Team",
      );
      expect(firstResult.ok).toBe(true);

      const result = await teamService.createTeam(
        playerId,
        leagueId,
        "Second Team",
      );

      expect(result.ok).toBe(false);
    });
  });

  describe("getMyTeam", () => {
    it("should return null when the player has no team in the league", async () => {
      const result = await teamService.getMyTeam(playerId, leagueId, "Alice");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it("should return the team DTO when the player has a team", async () => {
      await teamService.createTeam(playerId, leagueId, "Wiki Warriors");

      const result = await teamService.getMyTeam(playerId, leagueId, "Alice");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toBeNull();
        expect(result.value?.name).toBe("Wiki Warriors");
        expect(result.value?.credits).toBe(STARTING_CREDITS);
        expect(result.value?.player).toEqual({ id: playerId, name: "Alice" });
      }
    });

    it("should propagate a failure from an injected repository", async () => {
      const failingRepository: TeamRepository = {
        create: async () => failure("boom"),
        existsByNameInLeague: async () => failure("boom"),
        getByPlayerAndLeague: async () => failure("db error"),
      };
      const service = new TeamService({
        teamRepository: failingRepository,
        lineupRepository: {
          getByTeamId: async () => failure("unused"),
          upsert: async () => failure("unused"),
        },
      });

      const result = await service.getMyTeam(playerId, leagueId, "Alice");

      expect(result).toEqual(failure("db error"));
    });

    it("should map team fields correctly from an injected repository", async () => {
      const team: Team = {
        id: "team-42",
        name: "Injected Squad",
        playerId,
        leagueId,
        credits: 750,
      };
      const repository: TeamRepository = {
        create: async () => failure("unused"),
        existsByNameInLeague: async () => failure("unused"),
        getByPlayerAndLeague: async () => success(team),
      };
      const service = new TeamService({
        teamRepository: repository,
        lineupRepository: {
          getByTeamId: async () => failure("unused"),
          upsert: async () => failure("unused"),
        },
      });

      const result = await service.getMyTeam(playerId, leagueId, "Bob");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          id: "team-42",
          name: "Injected Squad",
          credits: 750,
          player: { id: playerId, name: "Bob" },
        });
      }
    });
  });
});

describe("TeamRepositoryD1 error handling", () => {
  const throwingDb = {
    prepare: () => {
      throw new Error("D1 unavailable");
    },
  } as unknown as D1Database;

  it("should return a failure from create when D1 throws", async () => {
    const repository = new TeamRepositoryD1(throwingDb);
    const result = await repository.create({
      name: "Test",
      playerId: "p1",
      leagueId: "l1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("D1 unavailable");
    }
  });

  it("should return a failure from existsByNameInLeague when D1 throws", async () => {
    const repository = new TeamRepositoryD1(throwingDb);
    const result = await repository.existsByNameInLeague("Test", "l1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("D1 unavailable");
    }
  });

  it("should return a failure from getByPlayerAndLeague when D1 throws", async () => {
    const repository = new TeamRepositoryD1(throwingDb);
    const result = await repository.getByPlayerAndLeague("p1", "l1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("D1 unavailable");
    }
  });
});
