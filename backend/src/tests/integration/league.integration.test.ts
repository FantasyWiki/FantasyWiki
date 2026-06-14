import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import { LeagueService, GLOBAL_LEAGUE_ID } from "../../services/league";

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
        expect(result.value.domain).toBe("en");
        expect(result.value.icon).toBe("🌍");
      }
    });
  });
});
