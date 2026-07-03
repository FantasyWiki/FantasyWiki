import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect } from "vitest";
import { LineupService, LineupServiceDeps } from "../services/lineup";
import { LineupRepository } from "../repositories/lineupRepository";
import { TeamRepository } from "../repositories/teamRepository";
import { ContractRepository } from "../repositories/contractRepository";
import { LeagueRepository } from "../repositories/leagueRepository";
import { PlayerRepository } from "../repositories/playerRepository";
import { success, failure } from "../repositories/result";
import type { Contract, Team, Lineup, League, Player } from "../../../model";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const PLAYER_ID = "player-1";
const LEAGUE_ID = "league-1";
const TEAM_ID = "team-1";

const team: Team = {
  id: TEAM_ID,
  name: "Test FC",
  playerId: PLAYER_ID,
  leagueId: LEAGUE_ID,
  credits: 1000,
};

const player: Player = {
  id: PLAYER_ID,
  username: "testuser",
};

const league: League = {
  id: LEAGUE_ID,
  name: "Test League",
  adminId: "admin-1",
  startDate: Temporal.Instant.from("2026-01-01T00:00:00Z"),
  endDate: Temporal.Instant.from("2026-12-31T00:00:00Z"),
  domain: "en",
  icon: "🌍",
};

function makeContract(id: string, articleId: string): Contract {
  return {
    id,
    teamId: TEAM_ID,
    articleId,
    purchaseDate: Temporal.PlainDate.from("2026-01-01"),
    expireDate: Temporal.PlainDate.from("2026-01-08"),
    purchasePrice: 50,
    settled: false,
    renewalCount: 0,
    renewalElected: false,
  };
}

function makeLineup(formation: Record<string, string>): Lineup {
  return {
    teamId: TEAM_ID,
    schema: "4-3-3",
    formation: JSON.stringify(formation),
    updatedAt: "2026-01-05T12:00:00Z",
  };
}

// ─── Fake repo builders ──────────────────────────────────────────────────────

function makeTeamRepo(result: Team | null = team): TeamRepository {
  return {
    create: async () => failure("unused"),
    existsByNameInLeague: async () => failure("unused"),
    getByPlayerAndLeague: async () => success(result),
  };
}

function makePlayerRepo(p: Player = player): PlayerRepository {
  return {
    save: async () => failure("unused"),
    getById: async () => success(p),
    getLeaguesByPlayerId: async () => failure("unused"),
    getPlayerByAccountId: async () => failure("unused"),
  };
}

function makeLeagueRepo(l: League = league): LeagueRepository {
  return {
    getById: async () => success(l),
  };
}

function makeContractRepo(contracts: Contract[]): ContractRepository {
  return {
    getByTeamId: async () => success(contracts),
    getById: async (id) => {
      const found = contracts.find((c) => c.id === id) ?? null;
      return success(found);
    },
    getByLeagueId: async () => success([]),
  };
}

function makeLineupRepo(stored: Lineup | null = null): LineupRepository {
  let current = stored;
  return {
    getByTeamId: async () => success(current),
    upsert: async (data) => {
      current = { ...data };
      return success(undefined);
    },
  };
}

function makeDeps(
  overrides: Partial<LineupServiceDeps> = {},
): LineupServiceDeps {
  return {
    lineupRepository: makeLineupRepo(),
    teamRepository: makeTeamRepo(),
    contractRepository: makeContractRepo([]),
    leagueRepository: makeLeagueRepo(),
    playerRepository: makePlayerRepo(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("LineupService (unit)", () => {
  describe("getLineup", () => {
    it("returns failure when no lineup row exists (invariant violation)", async () => {
      const service = new LineupService(makeDeps());
      const result = await service.getLineup(PLAYER_ID, LEAGUE_ID);
      expect(result.ok).toBe(false);
    });

    it("places formation contracts in their positions and the rest on the bench", async () => {
      const c1 = makeContract("c-1", "Cat");
      const c2 = makeContract("c-2", "Dog");
      const lineup = makeLineup({ GK: "c-1" }); // only c1 in formation

      const service = new LineupService(
        makeDeps({
          lineupRepository: makeLineupRepo(lineup),
          contractRepository: makeContractRepo([c1, c2]),
        }),
      );

      const result = await service.getLineup(PLAYER_ID, LEAGUE_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const value = result.value;
      expect(value.formation.formation["GK"]?.id).toBe("c-1");
      // c2 was not in the formation so it lands on the bench
      const benchIds = value.bench.map((c) => c.id);
      expect(benchIds).toContain("c-2");
      expect(benchIds).not.toContain("c-1");
    });

    it("silently omits stale formation slots (contract deleted after save)", async () => {
      // Lineup references c-1 in GK but contractRepo has NO contracts (simulates deletion)
      const lineup = makeLineup({ GK: "c-1" });

      const service = new LineupService(
        makeDeps({
          lineupRepository: makeLineupRepo(lineup),
          contractRepository: makeContractRepo([]), // stale — nothing in team
        }),
      );

      const result = await service.getLineup(PLAYER_ID, LEAGUE_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const value = result.value;
      // Stale slot should be silently omitted
      expect(value.formation.formation["GK"]).toBeUndefined();
      // Bench should also be empty
      expect(value.bench).toHaveLength(0);
    });

    it("returns a failure when the team repo returns an error", async () => {
      const service = new LineupService(
        makeDeps({
          teamRepository: {
            create: async () => failure("unused"),
            existsByNameInLeague: async () => failure("unused"),
            getByPlayerAndLeague: async () => failure("db error"),
          },
        }),
      );

      const result = await service.getLineup(PLAYER_ID, LEAGUE_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("db error");
    });

    it("returns failure when the player has no team in the league", async () => {
      const service = new LineupService(
        makeDeps({ teamRepository: makeTeamRepo(null) }),
      );

      const result = await service.getLineup(PLAYER_ID, LEAGUE_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("No team found");
    });

    it("returns a failure when the stored formation JSON is corrupted", async () => {
      const corruptLineup: Lineup = {
        teamId: TEAM_ID,
        schema: "4-3-3",
        formation: "INVALID_JSON",
        updatedAt: "2026-01-01T00:00:00Z",
      };

      const service = new LineupService(
        makeDeps({ lineupRepository: makeLineupRepo(corruptLineup) }),
      );

      const result = await service.getLineup(PLAYER_ID, LEAGUE_ID);
      expect(result.ok).toBe(false);
    });

    it("propagates failure when playerRepository.getById errors", async () => {
      const lineup = makeLineup({ GK: "c-1" });
      const service = new LineupService(
        makeDeps({
          lineupRepository: makeLineupRepo(lineup),
          playerRepository: {
            save: async () => failure("unused"),
            getById: async () => failure("Player not found"),
            getLeaguesByPlayerId: async () => failure("unused"),
            getPlayerByAccountId: async () => failure("unused"),
          },
        }),
      );

      const result = await service.getLineup(PLAYER_ID, LEAGUE_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("Player not found");
    });

    it("returns well-formed chemistry links ({from,to,level}), not raw [from,to] tuples", async () => {
      const c1 = makeContract("c-1", "Cat");
      const lineup = makeLineup({ GK: "c-1" });

      const service = new LineupService(
        makeDeps({
          lineupRepository: makeLineupRepo(lineup),
          contractRepository: makeContractRepo([c1]),
        }),
      );

      const result = await service.getLineup(PLAYER_ID, LEAGUE_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const chemistry = result.value.formation.chemistry as Array<{
        from: string;
        to: string;
        level: string;
      }>;
      expect(Array.isArray(chemistry)).toBe(true);
      expect(chemistry.length).toBeGreaterThan(0);
      for (const link of chemistry) {
        // A tuple would have undefined .from/.to and would not be an object link.
        expect(typeof link.from).toBe("string");
        expect(typeof link.to).toBe("string");
        expect(link.level).toBeDefined();
      }
    });

    it("exposes the league domain on each contract via the article field", async () => {
      const itLeague: League = { ...league, domain: "it" };
      const c1 = makeContract("c-1", "Gatto");
      const lineup = makeLineup({ GK: "c-1" });

      const service = new LineupService(
        makeDeps({
          lineupRepository: makeLineupRepo(lineup),
          contractRepository: makeContractRepo([c1]),
          leagueRepository: makeLeagueRepo(itLeague),
        }),
      );

      const result = await service.getLineup(PLAYER_ID, LEAGUE_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.formation.formation["GK"]?.article.domain).toBe("it");
    });
  });

  describe("saveLineup", () => {
    it("persists the slim formation (contract IDs only) via upsert", async () => {
      const c1 = makeContract("c-1", "Cat");
      let upsertCalled = false;
      let capturedFormation: Record<string, string> | undefined;

      const lineupRepo: LineupRepository = {
        getByTeamId: async () => success(null),
        upsert: async (data) => {
          upsertCalled = true;
          capturedFormation = JSON.parse(data.formation) as Record<
            string,
            string
          >;
          return success(undefined);
        },
      };

      const service = new LineupService(
        makeDeps({
          lineupRepository: lineupRepo,
          contractRepository: makeContractRepo([c1]),
        }),
      );

      const rawContract = {
        id: "c-1",
        team: {
          id: TEAM_ID,
          name: "Test FC",
          credits: 1000,
          player: { id: PLAYER_ID, name: "testuser" },
        },
        article: { id: "Cat", title: "Cat", domain: "en" as const },
        startDate: "2026-01-01T00:00:00Z",
        duration: "P7D",
        purchasePrice: 50,
      };

      const result = await service.saveLineup(PLAYER_ID, LEAGUE_ID, {
        formation: {
          date: new Date().toISOString(),
          schema: "4-3-3",
          formation: { GK: rawContract, ST: null },
        },
        bench: [],
      });

      expect(result.ok).toBe(true);
      expect(upsertCalled).toBe(true);
      // null positions must not appear in the stored formation
      expect(capturedFormation).toEqual({ GK: "c-1" });
    });

    it("returns a failure when a contract in the formation does not belong to the team", async () => {
      // Team owns nothing
      const service = new LineupService(
        makeDeps({ contractRepository: makeContractRepo([]) }),
      );

      const foreignContract = {
        id: "foreign-c",
        team: {
          id: "other-team",
          name: "Other FC",
          credits: 500,
          player: { id: "other-player", name: "other" },
        },
        article: { id: "Cat", title: "Cat", domain: "en" as const },
        startDate: "2026-01-01T00:00:00Z",
        duration: "P7D",
        purchasePrice: 50,
      };

      const result = await service.saveLineup(PLAYER_ID, LEAGUE_ID, {
        formation: {
          date: new Date().toISOString(),
          schema: "4-3-3",
          formation: { GK: foreignContract },
        },
        bench: [],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("foreign-c");
        expect(result.error.toLowerCase()).toContain("not owned");
      }
    });

    it("returns a failure when the team is not found", async () => {
      const service = new LineupService(
        makeDeps({ teamRepository: makeTeamRepo(null) }),
      );

      const result = await service.saveLineup(PLAYER_ID, LEAGUE_ID, {
        formation: { date: "", schema: "4-3-3", formation: {} },
        bench: [],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("No team found");
    });
  });
});
