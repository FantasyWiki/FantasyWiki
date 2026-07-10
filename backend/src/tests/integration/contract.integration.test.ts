import { env } from "cloudflare:workers";
import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import { ContractService, MAX_TEAM_CONTRACTS } from "../../services/contract";
import { NotificationService } from "../../services/notification";
import { LineupService, RawTeamLineUp } from "../../services/lineup";
import { PlayerService } from "../../services/player";
import { TeamRepositoryD1 } from "../../repositories/d1/teamRepositoryD1";
import { WikimediaClient } from "../../../../external-apis/wikimedia/client";
import { STARTING_CREDITS } from "../../../../model/team";
import {
  TIER_DAYS,
  computeContractPrice,
  normalizedViews,
  resolveLanguageScale,
} from "../../../../model/pricing";
import { insertTeam } from "../utils/d1TestUtils";

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

/**
 * Reads a team's current (derived) credits through the real repository
 * rather than a raw column read — credits are computed from the contracts
 * ledger, not stored.
 */
async function getDerivedCredits(
  playerId: string,
  leagueId: string,
): Promise<number | null> {
  const result = await new TeamRepositoryD1(env.db).getByPlayerAndLeague(
    playerId,
    leagueId,
  );
  if (!result.ok || result.value === null) return null;
  return result.value.credits;
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
    await insertTeam(env.db, {
      id: teamId,
      name: "Contract FC",
      playerId,
      leagueId,
    });
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
      credits: STARTING_CREDITS - 150,
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
    await insertTeam(env.db, {
      id: otherTeamId,
      name: "Other Contract FC",
      playerId,
      leagueId: otherLeagueId,
    });

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
    await insertTeam(env.db, {
      id: teamId,
      name: "Buy FC",
      playerId,
      leagueId,
    });
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
    expect(result.value.team.credits).toBe(STARTING_CREDITS - expectedPrice);
    expect(result.value.duration).toBe(`P${TIER_DAYS.MEDIUM}D`);

    const credits = await getDerivedCredits(playerId, leagueId);
    expect(credits).toBe(STARTING_CREDITS - expectedPrice);

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
    expect(contractsResult.value[0].team.credits).toBe(
      STARTING_CREDITS - expectedPrice,
    );
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
    await insertTeam(env.db, {
      id: otherTeamId,
      name: "Rival FC",
      playerId: rivalPlayerResult.value.id,
      leagueId,
    });
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

  it("rejects buying a contract once the team already holds MAX_TEAM_CONTRACTS", async () => {
    for (let i = 0; i < MAX_TEAM_CONTRACTS; i++) {
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
    // Credits are derived from the ledger, not a settable column: spend down
    // to 1 remaining credit via a pre-existing contract instead.
    await env.db
      .prepare(
        "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "contract-buy-drain",
        teamId,
        "Ethereum",
        "2026-01-01",
        "2026-01-08",
        STARTING_CREDITS - 1,
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

    expect(result).toEqual({ ok: false, error: "Not enough credits" });

    const credits = await getDerivedCredits(playerId, leagueId);
    expect(credits).toBe(1);

    const contractRow = await env.db
      .prepare("SELECT * FROM contracts WHERE teamId = ? AND articleId = ?")
      .bind(teamId, "Bitcoin")
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
    await insertTeam(env.db, {
      id: teamId,
      name: "My FC",
      playerId,
      leagueId,
    });
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
        credits: STARTING_CREDITS - 150,
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

describe("ContractService.sellContract Integration Tests", () => {
  let playerService: PlayerService;
  let leagueId: string;
  let playerId: string;
  let teamId: string;
  // insertSellableContract always uses purchasePrice: 0 (irrelevant to the
  // derived sum), so a fresh team's pre-sale credits is just STARTING_CREDITS.
  const INITIAL_CREDITS = STARTING_CREDITS;

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

  function priceFor(averageViews30d: number, tierDays: number) {
    return computeContractPrice(
      normalizedViews(averageViews30d, resolveLanguageScale("en")),
      tierDays,
    );
  }

  /**
   * Inserts an unsettled contract whose held tier is `tierDays` and whose
   * remaining life today is `remainingDays`, so the prorated ratio is exactly
   * `remainingDays / tierDays` regardless of the day the test runs.
   */
  async function insertSellableContract(opts: {
    id: string;
    tierDays: number;
    remainingDays: number;
    articleId?: string;
    ownerTeamId?: string;
  }): Promise<void> {
    const today = Temporal.Now.plainDateISO();
    const purchaseDate = today.subtract({
      days: opts.tierDays - opts.remainingDays,
    });
    const expireDate = today.add({ days: opts.remainingDays });
    await env.db
      .prepare(
        "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        opts.id,
        opts.ownerTeamId ?? teamId,
        opts.articleId ?? "Bitcoin",
        purchaseDate.toString(),
        expireDate.toString(),
        0,
      )
      .run();
  }

  beforeEach(async () => {
    playerService = new PlayerService(env.db);

    const playerResult = await playerService.createPlayer(
      "sellertester",
      "sellertester@example.com",
      "account-sell-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    leagueId = "league-sell-1";
    await env.db
      .prepare(
        `INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        leagueId,
        "Sell League",
        playerId,
        new Date().toISOString(),
        new Date().toISOString(),
        "en",
        "🏆",
      )
      .run();

    teamId = "team-sell-1";
    await insertTeam(env.db, {
      id: teamId,
      name: "Sell FC",
      playerId,
      leagueId,
    });
  });

  it("pays out the prorated ADR 0005 price, credits the team, and settles the row", async () => {
    // MEDIUM tier (7 days) with 4 days remaining -> ratio 4/7.
    await insertSellableContract({
      id: "contract-sell-1",
      tierDays: TIER_DAYS.MEDIUM,
      remainingDays: 4,
    });

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
    );

    const result = await service.sellContract(
      playerId,
      leagueId,
      "contract-sell-1",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const fullPrice = priceFor(9000, TIER_DAYS.MEDIUM);
    const expectedPayout = Math.max(
      0,
      Math.round((fullPrice * 4) / TIER_DAYS.MEDIUM),
    );
    expect(expectedPayout).toBeGreaterThan(0);
    expect(result.value.team.credits).toBe(INITIAL_CREDITS + expectedPayout);

    // Row is retained (settled=1), never deleted.
    const contractRow = await env.db
      .prepare("SELECT settled FROM contracts WHERE id = ?")
      .bind("contract-sell-1")
      .first<{ settled: number }>();
    expect(contractRow?.settled).toBe(1);

    // Credits persisted.
    const credits = await getDerivedCredits(playerId, leagueId);
    expect(credits).toBe(INITIAL_CREDITS + expectedPayout);
  });

  it("pays the full tier price when sold on the purchase day (ratio 1)", async () => {
    await insertSellableContract({
      id: "contract-sell-full",
      tierDays: TIER_DAYS.LONG,
      remainingDays: TIER_DAYS.LONG,
    });

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(120000),
    );

    const result = await service.sellContract(
      playerId,
      leagueId,
      "contract-sell-full",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expectedPayout = priceFor(120000, TIER_DAYS.LONG);
    expect(result.value.team.credits).toBe(INITIAL_CREDITS + expectedPayout);
  });

  it("pays 0 (never negative) for a contract already past expiry", async () => {
    // Expired yesterday: remaining is negative, so the ratio floors at 0.
    await insertSellableContract({
      id: "contract-sell-expired",
      tierDays: TIER_DAYS.SHORT,
      remainingDays: -1,
    });

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(120000),
    );

    const result = await service.sellContract(
      playerId,
      leagueId,
      "contract-sell-expired",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.team.credits).toBe(INITIAL_CREDITS);

    const credits = await getDerivedCredits(playerId, leagueId);
    expect(credits).toBe(INITIAL_CREDITS);
  });

  it("writes the sale notification to the inbox with the exact story message", async () => {
    await insertSellableContract({
      id: "contract-sell-notif",
      tierDays: TIER_DAYS.MEDIUM,
      remainingDays: 4,
      articleId: "Cristiano_Ronaldo",
    });

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
    );

    const sellResult = await service.sellContract(
      playerId,
      leagueId,
      "contract-sell-notif",
    );
    expect(sellResult.ok).toBe(true);

    const fullPrice = priceFor(9000, TIER_DAYS.MEDIUM);
    const expectedPayout = Math.round((fullPrice * 4) / TIER_DAYS.MEDIUM);

    // The notification is retrievable through the inbox and its contractId FK
    // still resolves (the contract row was retained, not deleted).
    const notificationService = new NotificationService(env.db);
    const notifications = await notificationService.getMyNotifications(
      playerId,
      leagueId,
    );
    expect(notifications.ok).toBe(true);
    if (!notifications.ok) return;

    expect(notifications.value).toHaveLength(1);
    // Display title uses spaces, not the underscored canonical id.
    expect(notifications.value[0].message).toBe(
      `Sold Cristiano Ronaldo early for ${expectedPayout} credits`,
    );
    expect(notifications.value[0].contract.id).toBe("contract-sell-notif");
  });

  it("removes the sold contract from the lineup (article returns to Free Agent)", async () => {
    await insertSellableContract({
      id: "contract-sell-lineup",
      tierDays: TIER_DAYS.MEDIUM,
      remainingDays: 4,
      articleId: "Bitcoin",
    });

    const lineupService = new LineupService(env.db);
    const payload: RawTeamLineUp = {
      formation: {
        date: new Date().toISOString(),
        schema: "4-3-3",
        formation: {
          GK: {
            id: "contract-sell-lineup",
            team: {
              id: teamId,
              name: "Sell FC",
              credits: INITIAL_CREDITS,
              player: { id: playerId, name: "sellertester" },
            },
            article: { id: "Bitcoin", title: "Bitcoin", domain: "en" },
            startDate: "2026-01-01T00:00:00Z",
            duration: "P7D",
            purchasePrice: 0,
          },
        },
      },
      bench: [],
    };
    const saveResult = await lineupService.saveLineup(
      playerId,
      leagueId,
      payload,
    );
    expect(saveResult.ok).toBe(true);

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
    );
    const sellResult = await service.sellContract(
      playerId,
      leagueId,
      "contract-sell-lineup",
    );
    expect(sellResult.ok).toBe(true);

    const lineupResult = await lineupService.getLineup(playerId, leagueId);
    expect(lineupResult.ok).toBe(true);
    if (!lineupResult.ok) return;

    // Gone from the formation slot...
    expect(lineupResult.value.formation.formation["GK"]).toBeUndefined();
    // ...and not lingering on the bench either.
    const benchIds = lineupResult.value.bench.map((c) => c.id);
    expect(benchIds).not.toContain("contract-sell-lineup");
  });

  it("rejects selling a contract owned by another team", async () => {
    // A second player + team owns the contract; our player must not sell it.
    const otherPlayerResult = await playerService.createPlayer(
      "sellother",
      "sellother@example.com",
      "account-sell-other-1",
    );
    expect(otherPlayerResult.ok).toBe(true);
    if (!otherPlayerResult.ok) throw new Error("setup failed: other player");
    const otherTeamId = "team-sell-other-1";
    await insertTeam(env.db, {
      id: otherTeamId,
      name: "Other Sell FC",
      playerId: otherPlayerResult.value.id,
      leagueId,
    });

    await insertSellableContract({
      id: "contract-sell-other",
      tierDays: TIER_DAYS.MEDIUM,
      remainingDays: 4,
      ownerTeamId: otherTeamId,
    });

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
    );
    const result = await service.sellContract(
      playerId,
      leagueId,
      "contract-sell-other",
    );

    expect(result).toEqual({
      ok: false,
      error: "You do not own this contract",
    });

    // Untouched: still unsettled, no payout to anyone.
    const contractRow = await env.db
      .prepare("SELECT settled FROM contracts WHERE id = ?")
      .bind("contract-sell-other")
      .first<{ settled: number }>();
    expect(contractRow?.settled).toBe(0);
    const otherTeamCredits = await getDerivedCredits(
      otherPlayerResult.value.id,
      leagueId,
    );
    expect(otherTeamCredits).toBe(STARTING_CREDITS);
  });

  it("fails with 'Contract not found' for an unknown contract id", async () => {
    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
    );
    const result = await service.sellContract(playerId, leagueId, "nope");
    expect(result).toEqual({ ok: false, error: "Contract not found" });
  });

  it("rejects selling an already-settled contract", async () => {
    await insertSellableContract({
      id: "contract-sell-twice",
      tierDays: TIER_DAYS.MEDIUM,
      remainingDays: 4,
    });
    await env.db
      .prepare("UPDATE contracts SET settled = 1 WHERE id = ?")
      .bind("contract-sell-twice")
      .run();

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
    );
    const result = await service.sellContract(
      playerId,
      leagueId,
      "contract-sell-twice",
    );
    expect(result).toEqual({ ok: false, error: "Contract already sold" });

    // No double payout.
    const credits = await getDerivedCredits(playerId, leagueId);
    expect(credits).toBe(INITIAL_CREDITS);
  });
});
