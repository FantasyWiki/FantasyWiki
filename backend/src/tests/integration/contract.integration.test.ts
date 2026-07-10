import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import { ContractService } from "../../services/contract";
import { PlayerService } from "../../services/player";
import { WikimediaClient } from "../../../../external-apis/wikimedia/client";
import {
  TIER_DAYS,
  computeContractPrice,
  normalizedViews,
  resolveLanguageScale,
} from "../../../../model/pricing";

/**
 * Build a WikimediaClient stub whose only exercised capability is
 * `pageviews.getArticleViews` — the buy-contract pricing lookup. Every other
 * namespace throws so an accidental dependency on it fails loudly.
 */
function wikimediaClientWithArticleViews(
  getArticleViews: WikimediaClient["pageviews"]["getArticleViews"],
): WikimediaClient {
  const unimplemented = () => {
    throw new Error("not implemented in stub");
  };
  return {
    pageviews: {
      getArticleViews,
      getTopReadList: unimplemented,
      getViewsByDomain: unimplemented,
    },
    article: {
      getSummary: unimplemented,
      getLinkedArticles: unimplemented,
      search: unimplemented,
    },
  } as unknown as WikimediaClient;
}

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

describe("ContractService.buyContract Integration Tests", () => {
  let playerService: PlayerService;
  let leagueId: string;
  let playerId: string;
  let teamId: string;

  function wikimediaWithAvg(averageViews30d: number): WikimediaClient {
    return wikimediaClientWithArticleViews(async () => ({
      latestDayViews: undefined,
      averageViews30d,
      weekViews: undefined,
      previousWeekViews: undefined,
      monthViews: undefined,
      yearViews: undefined,
    }));
  }

  function priceFor(
    averageViews30d: number,
    tier: "SHORT" | "MEDIUM" | "LONG",
  ) {
    return computeContractPrice(
      normalizedViews(averageViews30d, resolveLanguageScale("en")),
      TIER_DAYS[tier],
    );
  }

  beforeEach(async () => {
    playerService = new PlayerService(env.db);

    const playerResult = await playerService.createPlayer(
      "buyertester",
      "buyertester@example.com",
      "account-buy-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    leagueId = "league-buy-1";
    await env.db
      .prepare(
        `INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        leagueId,
        "Buy League",
        playerId,
        new Date().toISOString(),
        new Date().toISOString(),
        "en",
        "🏆",
      )
      .run();

    teamId = "team-buy-1";
    await env.db
      .prepare(
        "INSERT INTO teams (id, name, playerId, leagueId, credits) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(teamId, "Buy FC", playerId, leagueId, 1000)
      .run();
  });

  it("creates a contract and debits the exact ADR 0005 price from the team's credits", async () => {
    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
    );

    const result = await service.buyContract(
      playerId,
      leagueId,
      "Bitcoin",
      "MEDIUM",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expectedPrice = priceFor(9000, "MEDIUM");
    expect(result.value.purchasePrice).toBe(expectedPrice);
    expect(result.value.article).toEqual({
      id: "Bitcoin",
      title: "Bitcoin",
      domain: "en",
    });
    expect(result.value.team.credits).toBe(1000 - expectedPrice);
    expect(result.value.duration).toBe(`P${TIER_DAYS.MEDIUM}D`);

    const teamRow = await env.db
      .prepare("SELECT credits FROM teams WHERE id = ?")
      .bind(teamId)
      .first<{ credits: number }>();
    expect(teamRow?.credits).toBe(1000 - expectedPrice);

    const contractRow = await env.db
      .prepare("SELECT * FROM contracts WHERE teamId = ?")
      .bind(teamId)
      .first<{ articleId: string; settled: number }>();
    expect(contractRow?.articleId).toBe("Bitcoin");
    expect(contractRow?.settled).toBe(0);
  });

  it("reflects the debited credits on a subsequent read of the team's contracts", async () => {
    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
    );

    const buyResult = await service.buyContract(
      playerId,
      leagueId,
      "Bitcoin",
      "MEDIUM",
    );
    expect(buyResult.ok).toBe(true);
    if (!buyResult.ok) return;

    const expectedPrice = priceFor(9000, "MEDIUM");

    // Re-query the system through a fresh call rather than trusting the buy
    // result: the remaining credits must have been persisted.
    const readService = new ContractService(env.db);
    const contractsResult = await readService.getMyContracts(
      playerId,
      leagueId,
    );

    expect(contractsResult.ok).toBe(true);
    if (!contractsResult.ok) return;
    expect(contractsResult.value).toHaveLength(1);
    expect(contractsResult.value[0].team.credits).toBe(1000 - expectedPrice);
  });

  it("fails with 'No team found for this league' when the player has no team there", async () => {
    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
    );

    const result = await service.buyContract(
      playerId,
      "nonexistent-league",
      "Bitcoin",
      "MEDIUM",
    );

    expect(result).toEqual({
      ok: false,
      error: "No team found for this league",
    });
  });

  it("rejects an invalid tier", async () => {
    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
    );

    const result = await service.buyContract(
      playerId,
      leagueId,
      "Bitcoin",
      "ULTRA_LONG",
    );

    expect(result).toEqual({ ok: false, error: "Invalid contract tier" });
  });

  it("rejects buying an article already owned by another team in the league", async () => {
    const rivalPlayerResult = await playerService.createPlayer(
      "rivaltester",
      "rivaltester@example.com",
      "account-rival-1",
    );
    expect(rivalPlayerResult.ok).toBe(true);
    if (!rivalPlayerResult.ok) throw new Error("setup failed: rival player");

    const otherTeamId = "team-buy-other-1";
    await env.db
      .prepare(
        "INSERT INTO teams (id, name, playerId, leagueId, credits) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(otherTeamId, "Rival FC", rivalPlayerResult.value.id, leagueId, 1000)
      .run();
    await env.db
      .prepare(
        "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "contract-rival-1",
        otherTeamId,
        "Bitcoin",
        "2026-07-01",
        "2026-07-08",
        100,
      )
      .run();

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
    );

    const result = await service.buyContract(
      playerId,
      leagueId,
      "Bitcoin",
      "MEDIUM",
    );

    expect(result).toEqual({
      ok: false,
      error: "Article already owned by another team",
    });
  });

  it("rejects buying an article the team already owns", async () => {
    await env.db
      .prepare(
        "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "contract-mine-1",
        teamId,
        "Bitcoin",
        "2026-07-01",
        "2026-07-08",
        100,
      )
      .run();

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
    );

    const result = await service.buyContract(
      playerId,
      leagueId,
      "Bitcoin",
      "MEDIUM",
    );

    expect(result).toEqual({
      ok: false,
      error: "You already own this article",
    });
  });

  it("rejects buying an 12th contract once the team already holds 11", async () => {
    for (let i = 0; i < 11; i++) {
      await env.db
        .prepare(
          "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          `contract-full-${i}`,
          teamId,
          `Article_${i}`,
          "2026-07-01",
          "2026-07-08",
          10,
        )
        .run();
    }

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
    );

    const result = await service.buyContract(
      playerId,
      leagueId,
      "Bitcoin",
      "MEDIUM",
    );

    expect(result).toEqual({ ok: false, error: "Team is full (11 contracts)" });
  });

  it("rejects buying when the computed price exceeds the team's credits", async () => {
    await env.db
      .prepare("UPDATE teams SET credits = ? WHERE id = ?")
      .bind(1, teamId)
      .run();

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
    );

    const result = await service.buyContract(
      playerId,
      leagueId,
      "Bitcoin",
      "MEDIUM",
    );

    expect(result).toEqual({ ok: false, error: "Not enough credits" });

    const teamRow = await env.db
      .prepare("SELECT credits FROM teams WHERE id = ?")
      .bind(teamId)
      .first<{ credits: number }>();
    expect(teamRow?.credits).toBe(1);

    const contractRow = await env.db
      .prepare("SELECT * FROM contracts WHERE teamId = ?")
      .bind(teamId)
      .first();
    expect(contractRow).toBeNull();
  });
});

describe("ContractService.getMyContracts Integration Tests", () => {
  let playerService: PlayerService;
  let leagueId: string;
  let playerId: string;
  let teamId: string;

  beforeEach(async () => {
    playerService = new PlayerService(env.db);

    const playerResult = await playerService.createPlayer(
      "mycontractstester",
      "mycontractstester@example.com",
      "account-my-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    leagueId = "league-my-1";
    await env.db
      .prepare(
        `INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        leagueId,
        "My Contracts League",
        playerId,
        new Date().toISOString(),
        new Date().toISOString(),
        "it",
        "🏆",
      )
      .run();

    teamId = "team-my-1";
    await env.db
      .prepare(
        "INSERT INTO teams (id, name, playerId, leagueId, credits) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(teamId, "My FC", playerId, leagueId, 700)
      .run();
  });

  it("returns the team's active contracts as RawContracts", async () => {
    await env.db
      .prepare(
        "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "contract-mine-active",
        teamId,
        "Bitcoin",
        "2026-07-01",
        "2026-07-08",
        150,
      )
      .run();

    const service = new ContractService(env.db);
    const result = await service.getMyContracts(playerId, leagueId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
      id: "contract-mine-active",
      purchasePrice: 150,
      team: {
        id: teamId,
        name: "My FC",
        credits: 700,
        player: { id: playerId, name: "mycontractstester" },
      },
      article: { id: "Bitcoin", title: "Bitcoin", domain: "it" },
    });
  });

  it("excludes settled contracts", async () => {
    await env.db
      .prepare(
        "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice, settled) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "contract-mine-settled",
        teamId,
        "Ethereum",
        "2026-06-01",
        "2026-06-08",
        100,
        1,
      )
      .run();

    const service = new ContractService(env.db);
    const result = await service.getMyContracts(playerId, leagueId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it("fails with 'No team found for this league' when the player has no team there", async () => {
    const service = new ContractService(env.db);
    const result = await service.getMyContracts(playerId, "nonexistent-league");

    expect(result).toEqual({
      ok: false,
      error: "No team found for this league",
    });
  });
});
