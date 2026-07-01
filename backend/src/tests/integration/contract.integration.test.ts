import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import { ContractService } from "../../services/contract";
import { PlayerService } from "../../services/player";

describe("ContractService.getLeagueContracts Integration Tests", () => {
  let contractService: ContractService;
  let playerService: PlayerService;
  let leagueId: string;
  let otherLeagueId: string;
  let playerId: string;
  let teamId: string;

  beforeEach(async () => {
    contractService = new ContractService(env.db);
    playerService = new PlayerService(env.db);

    const playerResult = await playerService.createPlayer(
      "contracttester",
      "contracttester@example.com",
      "account-contract-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    leagueId = "league-contracts-1";
    await env.db
      .prepare(
        `INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        leagueId,
        "Contracts League",
        playerId,
        new Date().toISOString(),
        new Date().toISOString(),
        "it",
        "🏆",
      )
      .run();

    otherLeagueId = "league-contracts-2";
    await env.db
      .prepare(
        `INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        otherLeagueId,
        "Other Contracts League",
        playerId,
        new Date().toISOString(),
        new Date().toISOString(),
        "en",
        "🌍",
      )
      .run();

    teamId = "team-contracts-1";
    await env.db
      .prepare(
        "INSERT INTO teams (id, name, playerId, leagueId, credits) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(teamId, "Contract FC", playerId, leagueId, 850)
      .run();
  });

  it("maps every contract held by a team in the league to a RawContract", async () => {
    await env.db
      .prepare(
        "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "contract-league-1",
        teamId,
        "Bitcoin",
        "2026-01-01",
        "2026-01-08",
        150,
      )
      .run();

    const result = await contractService.getLeagueContracts(leagueId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);

    const raw = result.value[0];
    expect(raw.id).toBe("contract-league-1");
    expect(raw.purchasePrice).toBe(150);
    expect(raw.team).toEqual({
      id: teamId,
      name: "Contract FC",
      credits: 850,
      player: { id: playerId, name: "contracttester" },
    });
    // Domain comes from the league, not the contract row.
    expect(raw.article).toEqual({
      id: "Bitcoin",
      title: "Bitcoin",
      domain: "it",
    });
    expect(raw.duration).toBe("P7D");
  });

  it("only returns contracts for teams within the requested league", async () => {
    const otherTeamId = "team-contracts-other-1";
    await env.db
      .prepare(
        "INSERT INTO teams (id, name, playerId, leagueId, credits) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(otherTeamId, "Other Contract FC", playerId, otherLeagueId, 500)
      .run();

    await env.db
      .prepare(
        "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "contract-league-mine",
        teamId,
        "Bitcoin",
        "2026-01-01",
        "2026-01-08",
        150,
      )
      .run();

    await env.db
      .prepare(
        "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "contract-league-other",
        otherTeamId,
        "Ethereum",
        "2026-01-01",
        "2026-01-08",
        200,
      )
      .run();

    const result = await contractService.getLeagueContracts(leagueId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((c) => c.id)).toEqual(["contract-league-mine"]);
  });

  it("returns an empty list when the league has no contracts", async () => {
    const result = await contractService.getLeagueContracts(leagueId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it("propagates a failure when the league cannot be found", async () => {
    const result =
      await contractService.getLeagueContracts("nonexistent-league");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("not found");
    }
  });
});
