import { env } from "cloudflare:workers";
import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import { LeagueService, GLOBAL_LEAGUE_ID } from "../../services/league";
import { LeagueRepositoryD1 } from "../../repositories/d1/leagueRepositoryD1";
import { LeagueRepository } from "../../repositories/leagueRepository";
import { success, failure } from "../../repositories/result";
import { League } from "../../../../model";

describe("LeagueService Integration Tests", () => {
  let leagueService: LeagueService;

  beforeEach(() => {
    leagueService = new LeagueService(env.db);
  });

  describe("getGlobalLeague", () => {
    it("should return the Global League seeded by the migration", async () => {
      const result = await leagueService.getGlobalLeague();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe(GLOBAL_LEAGUE_ID);
        expect(result.value.title).toBe("Global League");
        expect(result.value.description).toBeTruthy();
        expect(result.value.domain).toBe("en");
        expect(result.value.icon).toBe("🌍");
        expect(result.value.teams).toEqual([]);
      }
    });

    it("should return a failure when the Global League does not exist", async () => {
      await env.db
        .prepare("DELETE FROM leagues WHERE id = ?")
        .bind(GLOBAL_LEAGUE_ID)
        .run();

      const result = await leagueService.getGlobalLeague();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain(GLOBAL_LEAGUE_ID);
        expect(result.error).toContain("not found");
      }
    });

    it("should propagate a failure from an injected repository", async () => {
      const failingRepository: LeagueRepository = {
        getById: async () => failure("boom"),
      };
      const service = new LeagueService(failingRepository);

      const result = await service.getGlobalLeague();

      expect(result).toEqual(failure("boom"));
    });

    it("should map a league returned by an injected repository to a LeagueDTO", async () => {
      const league: League = {
        id: GLOBAL_LEAGUE_ID,
        name: "Global League",
        adminId: "system",
        startDate: Temporal.Now.instant(),
        endDate: Temporal.Now.instant(),
        domain: "en",
        icon: "🌍",
      };

      const repository: LeagueRepository = {
        getById: async () => success(league),
      };
      const service = new LeagueService(repository);

      const result = await service.getGlobalLeague();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toMatchObject({
          id: league.id,
          title: league.name,
          domain: league.domain,
          icon: league.icon,
          teams: [],
        });
      }
    });
  });
});

describe("LeagueRepositoryD1 error handling", () => {
  it("should return a failure when the underlying D1 query throws", async () => {
    const throwingDb = {
      prepare: () => {
        throw new Error("D1 unavailable");
      },
    } as unknown as D1Database;

    const repository = new LeagueRepositoryD1(throwingDb);
    const result = await repository.getById(GLOBAL_LEAGUE_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("D1 unavailable");
    }
  });
});
