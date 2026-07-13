import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import { LineupService, RawTeamLineUp } from "../../services/lineup";
import { PlayerService } from "../../services/player";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import { insertTeam } from "../utils/d1TestUtils";

describe("LineupService Integration Tests", () => {
  let lineupService: LineupService;
  let playerService: PlayerService;
  let playerId: string;
  let teamId: string;

  beforeEach(async () => {
    lineupService = LineupService.fromDb(env.db);
    playerService = new PlayerService(env.db);

    const playerResult = await playerService.createPlayer(
      "lineuptester",
      "lineuptester@example.com",
      "account-lineup-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    teamId = "team-lineup-1";
    await insertTeam(env.db, {
      id: teamId,
      name: "Lineup FC",
      playerId,
      leagueId: GLOBAL_LEAGUE_ID,
    });
    await env.db
      .prepare(
        "INSERT INTO lineups (teamId, schema, formation, updatedAt) VALUES (?, ?, ?, ?)",
      )
      .bind(teamId, "4-3-3", "{}", new Date().toISOString())
      .run();
  });

  describe("getLineup", () => {
    it("should return an empty lineup for a newly created team", async () => {
      const result = await lineupService.getLineup(playerId, GLOBAL_LEAGUE_ID);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.formation.schema).toBe("4-3-3");
      expect(result.value.formation.formation).toEqual({});
      expect(result.value.bench).toHaveLength(0);
    });

    it("should return the correct formation and bench after saving a lineup", async () => {
      // Insert two contracts for this team
      const contractId1 = "contract-lu-1";
      const contractId2 = "contract-lu-2";

      await env.db
        .prepare(
          "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(contractId1, teamId, "Cat", "2026-01-01", "2026-01-08", 50)
        .run();

      await env.db
        .prepare(
          "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(contractId2, teamId, "Dog", "2026-01-01", "2026-01-08", 30)
        .run();

      // Build a payload putting only contract1 in the formation; contract2 should end up on bench
      const minimalContract = (id: string, articleId: string) => ({
        id,
        team: {
          id: teamId,
          name: "Lineup FC",
          credits: 1000,
          player: { id: playerId, name: "lineuptester" },
        },
        article: { id: articleId, title: articleId, domain: "en" as const },
        startDate: "2026-01-01T00:00:00Z",
        duration: "P7D",
        purchasePrice: 50,
      });

      const payload: RawTeamLineUp = {
        formation: {
          date: new Date().toISOString(),
          schema: "4-3-3",
          formation: {
            GK: minimalContract(contractId1, "Cat"),
            ST: null,
          },
        },
        bench: [],
      };

      const saveResult = await lineupService.saveLineup(
        playerId,
        GLOBAL_LEAGUE_ID,
        payload,
      );
      expect(saveResult.ok).toBe(true);

      const getResult = await lineupService.getLineup(
        playerId,
        GLOBAL_LEAGUE_ID,
      );

      expect(getResult.ok).toBe(true);
      if (!getResult.ok) return;
      const lineup = getResult.value;
      // contract1 should be in the formation under GK
      expect(lineup.formation.formation["GK"]).toBeDefined();
      expect(lineup.formation.formation["GK"]?.id).toBe(contractId1);

      // null positions should not appear in formation (ST was null)
      expect(lineup.formation.formation["ST"]).toBeUndefined();

      // contract2 was not placed in the formation, so it belongs on the bench
      const benchIds = lineup.bench.map((c) => c.id);
      expect(benchIds).toContain(contractId2);
      expect(benchIds).not.toContain(contractId1);
    });

    it("should return a failure when the player has no team in the league", async () => {
      const otherPlayerResult = await playerService.createPlayer(
        "noteamplayer",
        "noteam@example.com",
        "account-noteam-1",
      );
      expect(otherPlayerResult.ok).toBe(true);
      if (!otherPlayerResult.ok) throw new Error("setup failed");

      const result = await lineupService.getLineup(
        otherPlayerResult.value.id,
        GLOBAL_LEAGUE_ID,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("No team found");
      }
    });
  });

  describe("saveLineup", () => {
    it("should return a failure when a contractId in the formation does not belong to the team", async () => {
      // Insert a contract for a different team
      const otherTeamId = "team-other-1";
      const otherPlayerId = "player-other-1";

      await env.db
        .prepare(
          "INSERT INTO google_accounts (id, googleId, email) VALUES (?, ?, ?)",
        )
        .bind(otherPlayerId, "google-other-1", "other@example.com")
        .run();

      await env.db
        .prepare(
          "INSERT INTO players (id, username, accountId) VALUES (?, ?, ?)",
        )
        .bind(otherPlayerId, "otherplayer", otherPlayerId)
        .run();

      await insertTeam(env.db, {
        id: otherTeamId,
        name: "Other FC",
        playerId: otherPlayerId,
        leagueId: GLOBAL_LEAGUE_ID,
      });

      const foreignContractId = "contract-foreign-1";
      await env.db
        .prepare(
          "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          foreignContractId,
          otherTeamId,
          "Cat",
          "2026-01-01",
          "2026-01-08",
          50,
        )
        .run();

      const foreignContract = {
        id: foreignContractId,
        team: {
          id: otherTeamId,
          name: "Other FC",
          credits: 1000,
          player: { id: otherPlayerId, name: "otherplayer" },
        },
        article: { id: "Cat", title: "Cat", domain: "en" as const },
        startDate: "2026-01-01T00:00:00Z",
        duration: "P7D",
        purchasePrice: 50,
      };

      const payload: RawTeamLineUp = {
        formation: {
          date: new Date().toISOString(),
          schema: "4-3-3",
          formation: {
            GK: foreignContract,
          },
        },
        bench: [],
      };

      const result = await lineupService.saveLineup(
        playerId,
        GLOBAL_LEAGUE_ID,
        payload,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain(foreignContractId);
        expect(result.error.toLowerCase()).toContain("not owned");
      }
    });

    it("should return success and bench all contracts when the formation has all null positions", async () => {
      // Insert a contract for this team
      const contractId = "contract-lu-bench-1";
      await env.db
        .prepare(
          "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(contractId, teamId, "Cat", "2026-01-01", "2026-01-08", 50)
        .run();

      const payload: RawTeamLineUp = {
        formation: {
          date: new Date().toISOString(),
          schema: "4-3-3",
          formation: {
            GK: null,
            ST: null,
          },
        },
        bench: [],
      };

      const saveResult = await lineupService.saveLineup(
        playerId,
        GLOBAL_LEAGUE_ID,
        payload,
      );
      expect(saveResult.ok).toBe(true);

      const getResult = await lineupService.getLineup(
        playerId,
        GLOBAL_LEAGUE_ID,
      );

      expect(getResult.ok).toBe(true);
      if (!getResult.ok) return;
      const lineup = getResult.value;
      expect(lineup).not.toBeNull();

      // Formation should be empty (no positions filled)
      expect(Object.keys(lineup!.formation.formation)).toHaveLength(0);

      // Contract not placed anywhere, so it ends up on bench
      const benchIds = lineup!.bench.map((c) => c.id);
      expect(benchIds).toContain(contractId);
    });

    it("should silently omit stale contract slots and exclude the stale contract from bench on GET", async () => {
      // Insert a contract, save a lineup referencing it, then delete the contract
      const contractId = "contract-stale-1";
      await env.db
        .prepare(
          "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(contractId, teamId, "Cat", "2026-01-01", "2026-01-08", 50)
        .run();

      const staleContract = {
        id: contractId,
        team: {
          id: teamId,
          name: "Lineup FC",
          credits: 1000,
          player: { id: playerId, name: "lineuptester" },
        },
        article: { id: "Cat", title: "Cat", domain: "en" as const },
        startDate: "2026-01-01T00:00:00Z",
        duration: "P7D",
        purchasePrice: 50,
      };

      const payload: RawTeamLineUp = {
        formation: {
          date: new Date().toISOString(),
          schema: "4-3-3",
          formation: {
            GK: staleContract,
          },
        },
        bench: [],
      };

      const saveResult = await lineupService.saveLineup(
        playerId,
        GLOBAL_LEAGUE_ID,
        payload,
      );
      expect(saveResult.ok).toBe(true);

      // Now delete the contract (simulates expiry / removal)
      await env.db
        .prepare("DELETE FROM contracts WHERE id = ?")
        .bind(contractId)
        .run();

      const getResult = await lineupService.getLineup(
        playerId,
        GLOBAL_LEAGUE_ID,
      );

      expect(getResult.ok).toBe(true);
      if (!getResult.ok) return;
      const lineup = getResult.value;
      expect(lineup).not.toBeNull();

      // The stale slot should be silently omitted from the formation
      expect(lineup!.formation.formation["GK"]).toBeUndefined();

      // The stale contract must not appear on the bench either
      const benchIds = lineup!.bench.map((c) => c.id);
      expect(benchIds).not.toContain(contractId);
    });
  });
});
