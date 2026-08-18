import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import {
  LineupService,
  RawTeamLineUp,
  parseLineupPayload,
  LINEUP_ERRORS,
} from "../../services/lineup";
import { PlayerService } from "../../services/player";
import { TeamService } from "../../services/team";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import { unwrap } from "../../repositories/result";
import { anotherLeague } from "../support/subjects";
import { repositories } from "../support/target";
import type { Contract } from "../../../../model";

const HELD_FROM = Temporal.PlainDate.from("2026-01-01");
const HELD_UNTIL = Temporal.PlainDate.from("2026-01-08");

describe("LineupService Integration Tests", () => {
  let lineupService: LineupService;
  let playerService: PlayerService;
  let playerId: string;
  let teamId: string;

  /** A contract on `articleId` held by the suite's team. */
  async function holdArticle(articleId: string): Promise<Contract> {
    return unwrap(
      await repositories().contracts.create({
        teamId,
        articleId,
        purchaseDate: HELD_FROM,
        expireDate: HELD_UNTIL,
        purchasePrice: 50,
      }),
      `contract on ${articleId}`,
    );
  }

  /** Replaces the stored lineup wholesale, including states the domain rejects. */
  async function storeLineup(schema: string, formation: string): Promise<void> {
    unwrap(
      await repositories().lineups.upsert({
        teamId,
        schema,
        formation,
        updatedAt: new Date().toISOString(),
      }),
      "lineup",
    );
  }

  beforeEach(async () => {
    lineupService = new LineupService({
      ...repositories(),
      teamService: new TeamService(repositories()),
    });
    playerService = new PlayerService(repositories());

    playerId = unwrap(
      await playerService.createPlayer(
        "lineuptester",
        "lineuptester@example.com",
        "account-lineup-1",
      ),
      "player",
    ).id;

    teamId = unwrap(
      await new TeamService(repositories()).createTeam(
        playerId,
        GLOBAL_LEAGUE_ID,
        "Lineup FC",
      ),
      "team",
    ).id;
    await storeLineup("4-3-3", "{}");
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
      const contractId1 = (await holdArticle("Cat")).id;
      const contractId2 = (await holdArticle("Dog")).id;

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

  describe("getRivalLineup", () => {
    it("returns another team's lineup addressed by team id", async () => {
      // A second player fielding a team in the same league, with one contract
      // placed in the formation. getRivalLineup must surface exactly that team's
      // line-up, resolved from the team id in the path rather than the session.
      const rivalPlayerResult = await playerService.createPlayer(
        "rivalowner",
        "rival@example.com",
        "account-rival-1",
      );
      expect(rivalPlayerResult.ok).toBe(true);
      if (!rivalPlayerResult.ok) throw new Error("setup failed: rival player");

      const rivalTeamId = unwrap(
        await repositories().teams.create({
          name: "Rival FC",
          playerId: rivalPlayerResult.value.id,
          leagueId: GLOBAL_LEAGUE_ID,
        }),
        "rival team",
      ).id;

      const rivalContract = unwrap(
        await repositories().contracts.create({
          teamId: rivalTeamId,
          articleId: "Cat",
          purchaseDate: HELD_FROM,
          expireDate: HELD_UNTIL,
          purchasePrice: 50,
        }),
        "rival contract",
      );

      unwrap(
        await repositories().lineups.upsert({
          teamId: rivalTeamId,
          schema: "4-3-3",
          formation: JSON.stringify({ GK: rivalContract.id }),
          updatedAt: new Date().toISOString(),
        }),
        "rival lineup",
      );

      const result = await lineupService.getRivalLineup(
        GLOBAL_LEAGUE_ID,
        rivalTeamId,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.formation.schema).toBe("4-3-3");
      expect(result.value.formation.formation["GK"]?.id).toBe(rivalContract.id);
      // The contract carries the rival's team identity, not the caller's.
      expect(result.value.formation.formation["GK"]?.team.id).toBe(rivalTeamId);
    });

    it("reports a team that is not in the league as NO_TEAM, not an error", async () => {
      const result = await lineupService.getRivalLineup(
        GLOBAL_LEAGUE_ID,
        "team-not-in-this-league",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(LINEUP_ERRORS.NO_TEAM);
      }
    });

    // The team id alone would find this row; the league is the other half of
    // the key, so a line-up from a league the caller did not ask about must be
    // unreadable through it rather than merely unlikely to be requested.
    it("does not serve a team that exists in another league", async () => {
      const elsewhere = await anotherLeague();

      const outsiderPlayerResult = await playerService.createPlayer(
        "outsider",
        "outsider@example.com",
        "account-outsider-1",
      );
      expect(outsiderPlayerResult.ok).toBe(true);
      if (!outsiderPlayerResult.ok) throw new Error("setup failed: outsider");

      const outsiderTeamId = unwrap(
        await repositories().teams.create({
          name: "Outsider FC",
          playerId: outsiderPlayerResult.value.id,
          leagueId: elsewhere.id,
        }),
        "outsider team",
      ).id;
      unwrap(
        await repositories().lineups.upsert({
          teamId: outsiderTeamId,
          schema: "4-3-3",
          formation: JSON.stringify({}),
          updatedAt: new Date().toISOString(),
        }),
        "outsider lineup",
      );

      const result = await lineupService.getRivalLineup(
        GLOBAL_LEAGUE_ID,
        outsiderTeamId,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(LINEUP_ERRORS.NO_TEAM);
      }
    });
  });

  describe("saveLineup", () => {
    it("should return a failure when a contractId in the formation does not belong to the team", async () => {
      const otherPlayerId = unwrap(
        await playerService.createPlayer(
          "otherplayer",
          "other@example.com",
          "account-other-1",
        ),
        "other player",
      ).id;
      const otherTeamId = unwrap(
        await new TeamService(repositories()).createTeam(
          otherPlayerId,
          GLOBAL_LEAGUE_ID,
          "Other FC",
        ),
        "other team",
      ).id;

      // Deliberately owned by the other team, which is what must be rejected.
      const foreignContractId = unwrap(
        await repositories().contracts.create({
          teamId: otherTeamId,
          articleId: "Cat",
          purchaseDate: HELD_FROM,
          expireDate: HELD_UNTIL,
          purchasePrice: 50,
        }),
        "foreign contract",
      ).id;

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
      const contractId = (await holdArticle("Cat")).id;

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
      // Field a contract, then let it be settled underneath the lineup.
      const contractId = (await holdArticle("Cat")).id;

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

      // Settled at expiry, which is the state production actually reaches — the
      // row is retained, never deleted, so the notification's FK stays valid
      // (ADR 0003). The lineup still names it.
      unwrap(
        await repositories().contracts.settleExpiry(contractId, 60),
        "expiry settlement",
      );

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

  describe("parseLineupPayload", () => {
    const validPayload = (): RawTeamLineUp => ({
      formation: {
        date: new Date().toISOString(),
        schema: "4-3-3",
        formation: { GK: null },
      },
      bench: [],
    });

    it("should accept a well-formed payload", () => {
      const result = parseLineupPayload(validPayload());
      expect(result.ok).toBe(true);
    });

    it("should reject an empty object body", () => {
      const result = parseLineupPayload({});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(LINEUP_ERRORS.INVALID_PAYLOAD);
      }
    });

    it("should reject a non-object body", () => {
      for (const body of [null, "lineup", 42, []]) {
        const result = parseLineupPayload(body);
        expect(result.ok).toBe(false);
      }
    });

    it("should reject an unknown formation schema", () => {
      const payload = validPayload();
      payload.formation.schema = "5-4-1";
      const result = parseLineupPayload(payload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(LINEUP_ERRORS.UNKNOWN_SCHEMA);
      }
    });

    it("should reject a position that does not belong to the schema", () => {
      const payload = validPayload();
      // CB exists in 5-3-2 but not in 4-3-3
      payload.formation.formation = { CB: null };
      const result = parseLineupPayload(payload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(LINEUP_ERRORS.INVALID_PAYLOAD);
      }
    });

    it("should reject a formation entry without a contract id", () => {
      const payload = validPayload();
      payload.formation.formation = {
        GK: {
          article: { title: "Cat" },
        } as unknown as RawTeamLineUp["formation"]["formation"][string],
      };
      const result = parseLineupPayload(payload);
      expect(result.ok).toBe(false);
    });

    it("should reject a missing bench", () => {
      const payload = validPayload() as unknown as Record<string, unknown>;
      delete payload.bench;
      const result = parseLineupPayload(payload);
      expect(result.ok).toBe(false);
    });
  });

  describe("getLineup with corrupt stored schema", () => {
    it("should fail gracefully instead of crashing when the stored schema is unknown", async () => {
      await storeLineup("5-4-1", "{}");

      const result = await lineupService.getLineup(playerId, GLOBAL_LEAGUE_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Invalid formation data");
      }
    });
  });
});
