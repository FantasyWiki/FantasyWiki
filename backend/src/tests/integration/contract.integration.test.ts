import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import {
  ContractService,
  CONTRACT_ERRORS,
  MAX_TEAM_CONTRACTS,
} from "../../services/contract";
import { NotificationService } from "../../services/notification";
import { LineupService, RawTeamLineUp } from "../../services/lineup";
import { PlayerService } from "../../services/player";
import { TeamService } from "../../services/team";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import {
  ContractRepository,
  CONTRACT_WRITE_ERRORS,
  LeagueContractRow,
  NewContract,
} from "../../repositories/contractRepository";
import { success, failure, unwrap } from "../../repositories/result";
import { STARTING_CREDITS } from "../../../../model/team";
import type { Contract } from "../../../../model";
import {
  TIER_DAYS,
  computeContractPrice,
  normalizedViews,
} from "../../../../model/pricing";
import { REFERENCE_SCALE } from "../../../../model/languageScale";
import { repositories, store } from "../support/target";
import {
  unusedWikimedia,
  wikimediaWithArticleViews,
  wikimediaWithAvg,
} from "../support/wikimedia";

/**
 * Reads a team's current (derived) credits through the repository rather than a
 * column — credits are computed from the contracts ledger, not stored.
 */
async function getDerivedCredits(
  playerId: string,
  leagueId: string,
): Promise<number | null> {
  const result = await repositories().teams.getByPlayerAndLeague(
    playerId,
    leagueId,
  );
  if (!result.ok || result.value === null) return null;
  return result.value.credits;
}

/** A contract the team holds. The window is stated because tests turn on it. */
async function holdContract(spec: {
  teamId: string;
  articleId: string;
  purchasePrice: number;
  purchaseDate: string;
  expireDate: string;
}): Promise<Contract> {
  return unwrap(
    await repositories().contracts.create({
      teamId: spec.teamId,
      articleId: spec.articleId,
      purchaseDate: Temporal.PlainDate.from(spec.purchaseDate),
      expireDate: Temporal.PlainDate.from(spec.expireDate),
      purchasePrice: spec.purchasePrice,
    }),
    `contract on ${spec.articleId}`,
  );
}

/** The contract as stored, for the assertions that check a write landed. */
async function readContract(id: string): Promise<Contract | null> {
  return unwrap(
    await repositories().contracts.getById(id),
    "contract read-back",
  );
}

describe("ContractService.getLeagueContracts Integration Tests", () => {
  let contractService: ContractService;
  let playerService: PlayerService;
  let leagueId: string;
  let otherLeagueId: string;
  let playerId: string;
  let teamId: string;

  beforeEach(async () => {
    contractService = new ContractService({
      ...repositories(),
      wikimedia: unusedWikimedia(),
    });
    playerService = new PlayerService(repositories());

    const playerResult = await playerService.createPlayer(
      "contracttester",
      "contracttester@example.com",
      "account-contract-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    // An "it" league, so the domain the DTO reports is visibly the league's
    // rather than a default.
    leagueId = (
      await store().createLeague({
        id: "league-contracts-1",
        name: "Contracts League",
        adminId: playerId,
        domain: "it",
        icon: "🏆",
      })
    ).id;
    otherLeagueId = (
      await store().createLeague({
        id: "league-contracts-2",
        name: "Other Contracts League",
        adminId: playerId,
      })
    ).id;

    teamId = unwrap(
      await new TeamService(repositories()).createTeam(
        playerId,
        leagueId,
        "Contract FC",
      ),
      "team",
    ).id;
  });

  it("maps every contract held by a team in the league to a RawContract", async () => {
    const contract = await holdContract({
      teamId,
      articleId: "Bitcoin",
      purchasePrice: 150,
      purchaseDate: "2026-01-01",
      expireDate: "2026-01-08",
    });

    const result = await contractService.getLeagueContracts(leagueId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);

    const raw = result.value[0];
    expect(raw.id).toBe(contract.id);
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
    const otherTeamId = unwrap(
      await new TeamService(repositories()).createTeam(
        playerId,
        otherLeagueId,
        "Other Contract FC",
      ),
      "other team",
    ).id;

    const mine = await holdContract({
      teamId,
      articleId: "Bitcoin",
      purchasePrice: 150,
      purchaseDate: "2026-01-01",
      expireDate: "2026-01-08",
    });
    await holdContract({
      teamId: otherTeamId,
      articleId: "Ethereum",
      purchasePrice: 200,
      purchaseDate: "2026-01-01",
      expireDate: "2026-01-08",
    });

    const result = await contractService.getLeagueContracts(leagueId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((c) => c.id)).toEqual([mine.id]);
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

  function priceFor(
    averageViews30d: number,
    tier: "SHORT" | "MEDIUM" | "LONG",
  ) {
    return computeContractPrice(
      normalizedViews(averageViews30d, REFERENCE_SCALE),
      TIER_DAYS[tier],
    );
  }

  beforeEach(async () => {
    playerService = new PlayerService(repositories());

    const playerResult = await playerService.createPlayer(
      "buyertester",
      "buyertester@example.com",
      "account-buy-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    // Prices below assume the "en" language scale, which is the Global League's.
    leagueId = GLOBAL_LEAGUE_ID;
    teamId = unwrap(
      await new TeamService(repositories()).createTeam(
        playerId,
        leagueId,
        "Buy FC",
      ),
      "team",
    ).id;
  });

  it("creates a contract and debits the exact ADR 0005 price from the team's credits", async () => {
    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(9000),
    });

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

    const held = unwrap(
      await repositories().contracts.getByTeamId(teamId),
      "team's contracts",
    );
    expect(held).toHaveLength(1);
    expect(held[0].articleId).toBe("Bitcoin");
    expect(held[0].settled).toBe(false);
  });

  it("reflects the debited credits on a subsequent read of the team's contracts", async () => {
    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(9000),
    });

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
    const readService = new ContractService({
      ...repositories(),
      wikimedia: unusedWikimedia(),
    });
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
    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(9000),
    });

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
    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(9000),
    });

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

    const otherTeamId = unwrap(
      await new TeamService(repositories()).createTeam(
        rivalPlayerResult.value.id,
        leagueId,
        "Rival FC",
      ),
      "rival team",
    ).id;
    await holdContract({
      teamId: otherTeamId,
      articleId: "Bitcoin",
      purchasePrice: 100,
      purchaseDate: "2026-07-01",
      expireDate: "2026-07-08",
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(9000),
    });

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
    await holdContract({
      teamId,
      articleId: "Bitcoin",
      purchasePrice: 100,
      purchaseDate: "2026-07-01",
      expireDate: "2026-07-08",
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(9000),
    });

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
    for (let held = 0; held < MAX_TEAM_CONTRACTS; held++) {
      await holdContract({
        teamId,
        articleId: `Article_${held}`,
        purchasePrice: 10,
        purchaseDate: "2026-07-01",
        expireDate: "2026-07-08",
      });
    }

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(9000),
    });

    const result = await service.buyContract(
      playerId,
      leagueId,
      "Bitcoin",
      "MEDIUM",
    );

    expect(result).toEqual({
      ok: false,
      error: `Team is full (${MAX_TEAM_CONTRACTS} contracts)`,
    });
  });

  it("rejects buying when the computed price exceeds the team's credits", async () => {
    // Credits are derived from the ledger, not a settable column: spend down
    // to 1 remaining credit via a pre-existing contract instead.
    await holdContract({
      teamId,
      articleId: "Ethereum",
      purchasePrice: STARTING_CREDITS - 1,
      purchaseDate: "2026-01-01",
      expireDate: "2026-01-08",
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(9000),
    });

    const result = await service.buyContract(
      playerId,
      leagueId,
      "Bitcoin",
      "MEDIUM",
    );

    expect(result).toEqual({ ok: false, error: "Not enough credits" });

    const credits = await getDerivedCredits(playerId, leagueId);
    expect(credits).toBe(1);

    // The rejected buy wrote nothing: only the draining contract is held.
    const held = unwrap(
      await repositories().contracts.getByTeamId(teamId),
      "team's contracts",
    );
    expect(held.map((contract) => contract.articleId)).toEqual(["Ethereum"]);
  });

  it("rejects the buy when the views fetch omits averageViews30d", async () => {
    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithArticleViews(async () => ({
        latestDayViews: undefined,
        averageViews30d: undefined,
        weekViews: undefined,
        previousWeekViews: undefined,
        monthViews: undefined,
        yearViews: undefined,
      })),
    });

    const result = await service.buyContract(
      playerId,
      leagueId,
      "Bitcoin",
      "MEDIUM",
    );

    expect(result).toEqual({
      ok: false,
      error:
        "Couldn't fetch this article's views to price the contract. Please try again.",
    });
  });

  it("rejects the buy with the thrown error's message when the views fetch fails", async () => {
    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithArticleViews(async () => {
        throw new Error("Wikimedia API unavailable");
      }),
    });

    const result = await service.buyContract(
      playerId,
      leagueId,
      "Bitcoin",
      "MEDIUM",
    );

    expect(result).toEqual({ ok: false, error: "Wikimedia API unavailable" });
  });

  it("falls back to a generic message when the views fetch rejects with a non-Error", async () => {
    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithArticleViews(async () => {
        throw "network blip";
      }),
    });

    const result = await service.buyContract(
      playerId,
      leagueId,
      "Bitcoin",
      "MEDIUM",
    );

    expect(result).toEqual({
      ok: false,
      error: "Failed to fetch article views",
    });
  });
});

describe("ContractService.getMyContracts Integration Tests", () => {
  let playerService: PlayerService;
  let leagueId: string;
  let playerId: string;
  let teamId: string;

  beforeEach(async () => {
    playerService = new PlayerService(repositories());

    const playerResult = await playerService.createPlayer(
      "mycontractstester",
      "mycontractstester@example.com",
      "account-my-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    leagueId = (
      await store().createLeague({
        id: "league-my-1",
        name: "My Contracts League",
        adminId: playerId,
        domain: "it",
        icon: "🏆",
      })
    ).id;
    teamId = unwrap(
      await new TeamService(repositories()).createTeam(
        playerId,
        leagueId,
        "My FC",
      ),
      "team",
    ).id;
  });

  it("returns the team's active contracts as RawContracts", async () => {
    const active = await holdContract({
      teamId,
      articleId: "Bitcoin",
      purchasePrice: 150,
      purchaseDate: "2026-07-01",
      expireDate: "2026-07-08",
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: unusedWikimedia(),
    });
    const result = await service.getMyContracts(playerId, leagueId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
      id: active.id,
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
    const sold = await holdContract({
      teamId,
      articleId: "Ethereum",
      purchasePrice: 100,
      purchaseDate: "2026-06-01",
      expireDate: "2026-06-08",
    });
    unwrap(
      await repositories().contracts.settleSale(sold.id, teamId, 100),
      "sale",
    );

    const service = new ContractService({
      ...repositories(),
      wikimedia: unusedWikimedia(),
    });
    const result = await service.getMyContracts(playerId, leagueId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it("fails with 'No team found for this league' when the player has no team there", async () => {
    const service = new ContractService({
      ...repositories(),
      wikimedia: unusedWikimedia(),
    });
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

  function priceFor(averageViews30d: number, tierDays: number) {
    return computeContractPrice(
      normalizedViews(averageViews30d, REFERENCE_SCALE),
      tierDays,
    );
  }

  /**
   * Inserts an unsettled contract whose held tier is `tierDays` and whose
   * remaining life today is `remainingDays`, so the prorated ratio is exactly
   * `remainingDays / tierDays` regardless of the day the test runs.
   */
  async function insertSellableContract(opts: {
    tierDays: number;
    remainingDays: number;
    articleId: string;
    ownerTeamId?: string;
  }): Promise<Contract> {
    const today = Temporal.Now.plainDateISO();
    return unwrap(
      await repositories().contracts.create({
        teamId: opts.ownerTeamId ?? teamId,
        articleId: opts.articleId,
        purchaseDate: today.subtract({
          days: opts.tierDays - opts.remainingDays,
        }),
        expireDate: today.add({ days: opts.remainingDays }),
        // Irrelevant to the payout, and it keeps INITIAL_CREDITS simple.
        purchasePrice: 0,
      }),
      "sellable contract",
    );
  }

  beforeEach(async () => {
    playerService = new PlayerService(repositories());

    const playerResult = await playerService.createPlayer(
      "sellertester",
      "sellertester@example.com",
      "account-sell-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    // Payouts below assume the "en" language scale, which is the Global League's.
    leagueId = GLOBAL_LEAGUE_ID;
    teamId = unwrap(
      await new TeamService(repositories()).createTeam(
        playerId,
        leagueId,
        "Sell FC",
      ),
      "team",
    ).id;
  });

  it("pays out the prorated ADR 0005 price, credits the team, and settles the row", async () => {
    // MEDIUM tier (7 days) with 4 days remaining -> ratio 4/7.
    const contract = await insertSellableContract({
      articleId: "Bitcoin",
      tierDays: TIER_DAYS.MEDIUM,
      remainingDays: 4,
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(9000),
    });

    const result = await service.sellContract(playerId, leagueId, contract.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const fullPrice = priceFor(9000, TIER_DAYS.MEDIUM);
    const expectedPayout = Math.max(
      0,
      Math.round((fullPrice * 4) / TIER_DAYS.MEDIUM),
    );
    expect(expectedPayout).toBeGreaterThan(0);
    expect(result.value.team.credits).toBe(INITIAL_CREDITS + expectedPayout);

    // Retained as settled, never deleted (ADR 0003).
    expect((await readContract(contract.id))?.settled).toBe(true);

    // Credits persisted.
    const credits = await getDerivedCredits(playerId, leagueId);
    expect(credits).toBe(INITIAL_CREDITS + expectedPayout);
  });

  it("pays the full tier price when sold on the purchase day (ratio 1)", async () => {
    const contract = await insertSellableContract({
      articleId: "Bitcoin",
      tierDays: TIER_DAYS.LONG,
      remainingDays: TIER_DAYS.LONG,
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(120000),
    });

    const result = await service.sellContract(playerId, leagueId, contract.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expectedPayout = priceFor(120000, TIER_DAYS.LONG);
    expect(result.value.team.credits).toBe(INITIAL_CREDITS + expectedPayout);
  });

  it("pays 0 (never negative) for a contract already past expiry", async () => {
    // Expired yesterday: remaining is negative, so the ratio floors at 0.
    const contract = await insertSellableContract({
      articleId: "Bitcoin",
      tierDays: TIER_DAYS.SHORT,
      remainingDays: -1,
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(120000),
    });

    const result = await service.sellContract(playerId, leagueId, contract.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.team.credits).toBe(INITIAL_CREDITS);

    const credits = await getDerivedCredits(playerId, leagueId);
    expect(credits).toBe(INITIAL_CREDITS);
  });

  it("writes the sale notification to the inbox with the exact story message", async () => {
    const contract = await insertSellableContract({
      tierDays: TIER_DAYS.MEDIUM,
      remainingDays: 4,
      articleId: "Cristiano_Ronaldo",
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(9000),
    });

    const sellResult = await service.sellContract(
      playerId,
      leagueId,
      contract.id,
    );
    expect(sellResult.ok).toBe(true);

    const fullPrice = priceFor(9000, TIER_DAYS.MEDIUM);
    const expectedPayout = Math.round((fullPrice * 4) / TIER_DAYS.MEDIUM);

    // The notification is retrievable through the inbox and its contractId FK
    // still resolves (the contract row was retained, not deleted).
    const notificationService = new NotificationService(repositories());
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
    expect(notifications.value[0].contract.id).toBe(contract.id);
  });

  it("removes the sold contract from the lineup (article returns to Free Agent)", async () => {
    const contract = await insertSellableContract({
      tierDays: TIER_DAYS.MEDIUM,
      remainingDays: 4,
      articleId: "Bitcoin",
    });

    const lineupService = new LineupService({
      ...repositories(),
      teamService: new TeamService(repositories()),
    });
    const payload: RawTeamLineUp = {
      formation: {
        date: new Date().toISOString(),
        schema: "4-3-3",
        formation: {
          GK: {
            id: contract.id,
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

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(9000),
    });
    const sellResult = await service.sellContract(
      playerId,
      leagueId,
      contract.id,
    );
    expect(sellResult.ok).toBe(true);

    const lineupResult = await lineupService.getLineup(playerId, leagueId);
    expect(lineupResult.ok).toBe(true);
    if (!lineupResult.ok) return;

    // Gone from the formation slot...
    expect(lineupResult.value.formation.formation["GK"]).toBeUndefined();
    // ...and not lingering on the bench either.
    const benchIds = lineupResult.value.bench.map((c) => c.id);
    expect(benchIds).not.toContain(contract.id);
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
    const otherTeamId = unwrap(
      await new TeamService(repositories()).createTeam(
        otherPlayerResult.value.id,
        leagueId,
        "Other Sell FC",
      ),
      "other team",
    ).id;

    const theirs = await insertSellableContract({
      articleId: "Bitcoin",
      tierDays: TIER_DAYS.MEDIUM,
      remainingDays: 4,
      ownerTeamId: otherTeamId,
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(9000),
    });
    const result = await service.sellContract(playerId, leagueId, theirs.id);

    expect(result).toEqual({
      ok: false,
      error: "You do not own this contract",
    });

    // Untouched: still unsettled, no payout to anyone.
    expect((await readContract(theirs.id))?.settled).toBe(false);
    const otherTeamCredits = await getDerivedCredits(
      otherPlayerResult.value.id,
      leagueId,
    );
    expect(otherTeamCredits).toBe(STARTING_CREDITS);
  });

  it("fails with 'Contract not found' for an unknown contract id", async () => {
    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(9000),
    });
    const result = await service.sellContract(playerId, leagueId, "nope");
    expect(result).toEqual({ ok: false, error: "Contract not found" });
  });

  it("rejects selling an already-settled contract", async () => {
    const contract = await insertSellableContract({
      articleId: "Bitcoin",
      tierDays: TIER_DAYS.MEDIUM,
      remainingDays: 4,
    });
    // Already sold once, for nothing — the payout is beside the point here.
    unwrap(
      await repositories().contracts.settleSale(contract.id, teamId, 0),
      "first sale",
    );

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(9000),
    });
    const result = await service.sellContract(playerId, leagueId, contract.id);
    expect(result).toEqual({ ok: false, error: "Contract already sold" });

    // No double payout.
    const credits = await getDerivedCredits(playerId, leagueId);
    expect(credits).toBe(INITIAL_CREDITS);
  });

  it("rejects the sale when the views fetch omits averageViews30d", async () => {
    const contract = await insertSellableContract({
      articleId: "Bitcoin",
      tierDays: TIER_DAYS.MEDIUM,
      remainingDays: 4,
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithArticleViews(async () => ({
        latestDayViews: undefined,
        averageViews30d: undefined,
        weekViews: undefined,
        previousWeekViews: undefined,
        monthViews: undefined,
        yearViews: undefined,
      })),
    });

    const result = await service.sellContract(playerId, leagueId, contract.id);

    expect(result).toEqual({
      ok: false,
      error:
        "Couldn't fetch this article's views to price the sale. Please try again.",
    });

    // No payout on the rejected sale.
    const credits = await getDerivedCredits(playerId, leagueId);
    expect(credits).toBe(INITIAL_CREDITS);
  });

  it("rejects the sale with the thrown error's message when the views fetch fails", async () => {
    const contract = await insertSellableContract({
      articleId: "Bitcoin",
      tierDays: TIER_DAYS.MEDIUM,
      remainingDays: 4,
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithArticleViews(async () => {
        throw new Error("Wikimedia API unavailable");
      }),
    });

    const result = await service.sellContract(playerId, leagueId, contract.id);

    expect(result).toEqual({ ok: false, error: "Wikimedia API unavailable" });
  });

  it("falls back to a generic message when the sale's views fetch rejects with a non-Error", async () => {
    const contract = await insertSellableContract({
      articleId: "Bitcoin",
      tierDays: TIER_DAYS.MEDIUM,
      remainingDays: 4,
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithArticleViews(async () => {
        throw "network blip";
      }),
    });

    const result = await service.sellContract(playerId, leagueId, contract.id);

    expect(result).toEqual({
      ok: false,
      error: "Failed to fetch article views",
    });
  });
});

describe("the guarded contract write", () => {
  // Exercises the write-time guard directly, bypassing the service's
  // pre-checks — i.e. the exact state a concurrent purchase creates between
  // a buyer's reads and their write. Every implementation owes these, however it
  // achieves atomicity, which is why they go through the interface.
  let repo: ContractRepository;
  let playerService: PlayerService;
  let leagueId: string;
  let otherLeagueId: string;
  let teamId: string;
  let rivalTeamId: string;

  function newContract(
    forTeamId: string,
    articleId: string,
    purchasePrice = 10,
  ): NewContract {
    const purchaseDate = Temporal.Now.plainDateISO();
    return {
      teamId: forTeamId,
      articleId,
      purchaseDate,
      expireDate: purchaseDate.add({ days: 7 }),
      purchasePrice,
    };
  }

  beforeEach(async () => {
    repo = repositories().contracts;
    playerService = new PlayerService(repositories());
    const teamService = new TeamService(repositories());

    const buyer = await playerService.createPlayer(
      "guardbuyer",
      "guardbuyer@example.com",
      "account-guard-1",
    );
    const rival = await playerService.createPlayer(
      "guardrival",
      "guardrival@example.com",
      "account-guard-2",
    );
    if (!buyer.ok || !rival.ok) throw new Error("setup failed: players");

    leagueId = GLOBAL_LEAGUE_ID;
    otherLeagueId = (
      await store().createLeague({
        id: "league-guard-2",
        name: "Other Guard League",
        adminId: buyer.value.id,
      })
    ).id;

    teamId = unwrap(
      await teamService.createTeam(buyer.value.id, leagueId, "Guard FC"),
      "team",
    ).id;
    rivalTeamId = unwrap(
      await teamService.createTeam(rival.value.id, leagueId, "Guard Rivals"),
      "rival team",
    ).id;
  });

  it("rejects the write when another team in the league holds an active contract on the article", async () => {
    const rivalResult = await repo.create(newContract(rivalTeamId, "Bitcoin"));
    expect(rivalResult.ok).toBe(true);

    const result = await repo.create(newContract(teamId, "Bitcoin"));

    expect(result).toEqual({
      ok: false,
      error: CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT,
    });
  });

  it("rejects the write when the team already holds an active contract on the article", async () => {
    const first = await repo.create(newContract(teamId, "Bitcoin"));
    expect(first.ok).toBe(true);

    const result = await repo.create(newContract(teamId, "Bitcoin"));

    expect(result).toEqual({
      ok: false,
      error: CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT,
    });
  });

  it("allows the write when the article's only contract in the league is settled", async () => {
    const rivalResult = await repo.create(newContract(rivalTeamId, "Bitcoin"));
    expect(rivalResult.ok).toBe(true);
    if (!rivalResult.ok) return;
    const settle = await repo.settleSale(rivalResult.value.id, rivalTeamId, 5);
    expect(settle).toEqual({ ok: true, value: true });

    const result = await repo.create(newContract(teamId, "Bitcoin"));

    expect(result.ok).toBe(true);
  });

  it("does not let a contract in a different league block the article", async () => {
    const foreignPlayer = await playerService.createPlayer(
      "guardforeign",
      "guardforeign@example.com",
      "account-guard-3",
    );
    if (!foreignPlayer.ok) throw new Error("setup failed: foreign player");
    const foreignTeamId = unwrap(
      await new TeamService(repositories()).createTeam(
        foreignPlayer.value.id,
        otherLeagueId,
        "Foreign FC",
      ),
      "foreign team",
    ).id;
    const foreignResult = await repo.create(
      newContract(foreignTeamId, "Bitcoin"),
    );
    expect(foreignResult.ok).toBe(true);

    const result = await repo.create(newContract(teamId, "Bitcoin"));

    expect(result.ok).toBe(true);
  });

  it("rejects the write once the team holds MAX_TEAM_CONTRACTS active contracts", async () => {
    for (let i = 0; i < MAX_TEAM_CONTRACTS; i++) {
      const filler = await repo.create(newContract(teamId, `Article_${i}`, 1));
      expect(filler.ok).toBe(true);
    }

    const result = await repo.create(newContract(teamId, "Bitcoin"));

    expect(result).toEqual({
      ok: false,
      error: CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT,
    });
  });

  it("rejects the write when the derived credits no longer cover the price", async () => {
    const spendAll = await repo.create(
      newContract(teamId, "Ethereum", STARTING_CREDITS),
    );
    expect(spendAll.ok).toBe(true);

    const result = await repo.create(newContract(teamId, "Bitcoin", 1));

    expect(result).toEqual({
      ok: false,
      error: CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT,
    });
  });
});

describe("ContractService.buyContract conflict classification", () => {
  it("names the rule a concurrent purchase broke when the guarded INSERT rejects", async () => {
    // The pre-check read sees a free article; the write conflicts; the
    // re-read (second getByLeagueId call) reveals a rival's fresh contract.
    const purchaseDate = Temporal.Now.plainDateISO();
    const rivalContract: LeagueContractRow = {
      id: "contract-rival-race",
      teamId: "team-rival-race",
      articleId: "Bitcoin",
      purchaseDate,
      expireDate: purchaseDate.add({ days: 7 }),
      purchasePrice: 10,
      settled: false,
      renewalCount: 0,
      renewalElected: false,
      teamName: "Race Rivals",
      teamCredits: 990,
      playerId: "player-rival-race",
      playerName: "racerival",
    };
    let leagueReads = 0;
    const unimplemented = () => {
      throw new Error("not implemented in stub");
    };
    const contractRepo = {
      getByLeagueId: async () => {
        leagueReads++;
        return success(leagueReads === 1 ? [] : [rivalContract]);
      },
      create: async () => failure(CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT),
      getByTeamId: unimplemented,
      getById: unimplemented,
      settleSale: unimplemented,
    } as unknown as ContractRepository;

    const playerService = new PlayerService(repositories());
    const playerResult = await playerService.createPlayer(
      "racebuyer",
      "racebuyer@example.com",
      "account-race-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) return;

    const leagueId = GLOBAL_LEAGUE_ID;
    unwrap(
      await new TeamService(repositories()).createTeam(
        playerResult.value.id,
        leagueId,
        "Race FC",
      ),
      "team",
    );

    const service = new ContractService({
      ...repositories(),
      contracts: contractRepo,
      wikimedia: wikimediaWithArticleViews(async () => ({
        latestDayViews: undefined,
        averageViews30d: 9000,
        weekViews: undefined,
        previousWeekViews: undefined,
        monthViews: undefined,
        yearViews: undefined,
      })),
    });

    const result = await service.buyContract(
      playerResult.value.id,
      leagueId,
      "Bitcoin",
      "MEDIUM",
    );

    expect(result).toEqual({
      ok: false,
      error: "Article already owned by another team",
    });
    expect(leagueReads).toBe(2);
  });

  /**
   * The re-read exists only to name which rule the concurrent purchase broke.
   * If it cannot run, the purchase still has to be reported as rejected — the
   * INSERT did not apply — rather than surfacing a database error as if the
   * player had done something wrong.
   */
  it("still reports a conflict when the classifying re-read fails", async () => {
    let leagueReads = 0;
    const unimplemented = () => {
      throw new Error("not implemented in stub");
    };
    const contractRepo = {
      getByLeagueId: async () => {
        leagueReads++;
        return leagueReads === 1
          ? success([])
          : failure("Error fetching league contracts: D1 unavailable");
      },
      create: async () => failure(CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT),
      getByTeamId: unimplemented,
      getById: unimplemented,
      settleSale: unimplemented,
    } as unknown as ContractRepository;

    const playerService = new PlayerService(repositories());
    const playerResult = await playerService.createPlayer(
      "classifybuyer",
      "classifybuyer@example.com",
      "account-classify-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) return;

    const leagueId = GLOBAL_LEAGUE_ID;
    unwrap(
      await new TeamService(repositories()).createTeam(
        playerResult.value.id,
        leagueId,
        "Classify FC",
      ),
      "team",
    );

    const service = new ContractService({
      ...repositories(),
      contracts: contractRepo,
      wikimedia: wikimediaWithArticleViews(async () => ({
        latestDayViews: undefined,
        averageViews30d: 9000,
        weekViews: undefined,
        previousWeekViews: undefined,
        monthViews: undefined,
        yearViews: undefined,
      })),
    });

    const result = await service.buyContract(
      playerResult.value.id,
      leagueId,
      "Bitcoin",
      "MEDIUM",
    );

    expect(result).toEqual({
      ok: false,
      error: CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT,
    });
    expect(leagueReads).toBe(2);
  });
});

/**
 * Electing renewal only records an intent — the daily settlement sweep is what
 * actually renews — so the intent stays withdrawable right up until that sweep
 * runs, including after the expireDate has passed but before the row is settled.
 */
describe("ContractService.cancelRenewal Integration Tests", () => {
  let service: ContractService;
  let leagueId: string;
  let playerId: string;
  let teamId: string;

  /** An unsettled contract expiring in `remainingDays` (negative = past due, unswept). */
  async function insertContract(opts: {
    remainingDays: number;
    renewalElected?: boolean;
    settled?: boolean;
  }): Promise<Contract> {
    const today = Temporal.Now.plainDateISO();
    const contracts = repositories().contracts;

    const created = unwrap(
      await contracts.create({
        teamId,
        articleId: "Bitcoin",
        purchaseDate: today.subtract({ days: TIER_DAYS.MEDIUM }),
        expireDate: today.add({ days: opts.remainingDays }),
        purchasePrice: 0,
      }),
      "contract",
    );

    // Order matters: settling first would leave nothing electable.
    if (opts.renewalElected) {
      unwrap(
        await contracts.electRenewal(created.id, teamId),
        "renewal election",
      );
    }
    if (opts.settled) {
      unwrap(await contracts.settleSale(created.id, teamId, 0), "sale");
    }
    return created;
  }

  async function readElected(contractId: string): Promise<boolean | undefined> {
    const contract = unwrap(
      await repositories().contracts.getById(contractId),
      "contract read-back",
    );
    return contract?.renewalElected;
  }

  beforeEach(async () => {
    service = new ContractService({
      ...repositories(),
      wikimedia: unusedWikimedia(),
    });

    const playerResult = await new PlayerService(repositories()).createPlayer(
      "canceltester",
      "canceltester@example.com",
      "account-cancel-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    leagueId = GLOBAL_LEAGUE_ID;
    teamId = unwrap(
      await new TeamService(repositories()).createTeam(
        playerId,
        leagueId,
        "Cancel FC",
      ),
      "team",
    ).id;
  });

  it("withdraws an election made through electRenewal", async () => {
    const contract = await insertContract({ remainingDays: 1 });

    const elect = await service.electRenewal(playerId, leagueId, contract.id);
    expect(elect.ok).toBe(true);
    expect(await readElected(contract.id)).toBe(true);

    const result = await service.cancelRenewal(playerId, leagueId, contract.id);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.renewalElected).toBe(false);
    expect(await readElected(contract.id)).toBe(false);
  });

  it("still withdraws once the term has lapsed but the sweep has not run", async () => {
    const contract = await insertContract({
      remainingDays: -2,
      renewalElected: true,
    });

    const result = await service.cancelRenewal(playerId, leagueId, contract.id);
    expect(result.ok).toBe(true);
    expect(await readElected(contract.id)).toBe(false);
  });

  it("rejects a contract with no renewal elected", async () => {
    const contract = await insertContract({ remainingDays: 1 });

    const result = await service.cancelRenewal(playerId, leagueId, contract.id);
    expect(result).toEqual({
      ok: false,
      error: CONTRACT_ERRORS.RENEWAL_NOT_ELECTED,
    });
  });

  it("rejects a contract the sweep has already settled", async () => {
    const contract = await insertContract({
      remainingDays: -1,
      renewalElected: true,
      settled: true,
    });

    const result = await service.cancelRenewal(playerId, leagueId, contract.id);
    expect(result).toEqual({
      ok: false,
      error: CONTRACT_ERRORS.ALREADY_SETTLED,
    });
  });
});
