import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, vi } from "vitest";
import { ContractService } from "../services/contract";
import {
  ContractRepository,
  NewContract,
} from "../repositories/contractRepository";
import { LeagueRepository } from "../repositories/leagueRepository";
import { TeamRepository } from "../repositories/teamRepository";
import { PlayerRepository } from "../repositories/playerRepository";
import { NotificationRepository } from "../repositories/notificationRepository";
import { WikimediaClient } from "../../../external-apis/wikimedia/client";
import {
  computeContractPrice,
  normalizedViews,
  resolveLanguageScale,
  TIER_DAYS,
} from "../../../model/pricing";
import { Result, success, failure } from "../repositories/result";
import type { Contract, Team, Player, League } from "../../../model";

/** Mirror the service's server-side price computation for `en` (league domain). */
function priceFor(averageViews30d: number, tierDays: number): number {
  return computeContractPrice(
    normalizedViews(averageViews30d, resolveLanguageScale("en")),
    tierDays,
  );
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const PLAYER_ID = "player-1";
const LEAGUE_ID = "league-1";
const TEAM_ID = "team-1";
const CONTRACT_ID = "contract-1";

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

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: CONTRACT_ID,
    teamId: TEAM_ID,
    articleId: "Some_Article",
    purchaseDate: Temporal.PlainDate.from("2026-01-01"),
    expireDate: Temporal.PlainDate.from("2026-01-08"),
    purchasePrice: 50,
    settled: false,
    renewalCount: 0,
    renewalElected: false,
    ...overrides,
  };
}

// ─── Fake repo builders ──────────────────────────────────────────────────────

function makeTeamRepo(
  result: Result<Team | null> = success(team),
): TeamRepository {
  return {
    create: async () => failure("unused"),
    existsByNameInLeague: async () => failure("unused"),
    getByPlayerAndLeague: async () => result,
  };
}

function makeLeagueRepo(
  result: Result<League> = success(league),
): LeagueRepository {
  return {
    getById: async () => result,
  };
}

function makePlayerRepo(
  result: Result<Player> = success(player),
): PlayerRepository {
  return {
    save: async () => failure("unused"),
    getById: async () => result,
    getLeaguesByPlayerId: async () => failure("unused"),
    getPlayerByAccountId: async () => failure("unused"),
  };
}

function makeContractRepo(
  overrides: Partial<ContractRepository> = {},
): ContractRepository {
  return {
    getByTeamId: async () => success([]),
    getById: async () => success(makeContract()),
    getByLeagueId: async () => success([]),
    create: async (newContract: NewContract) =>
      success({
        id: "new-contract",
        teamId: newContract.teamId,
        articleId: newContract.articleId,
        purchaseDate: newContract.purchaseDate,
        expireDate: newContract.expireDate,
        purchasePrice: newContract.purchasePrice,
        settled: false,
        renewalCount: 0,
        renewalElected: false,
      }),
    settleSale: async () => success(true),
    ...overrides,
  };
}

function makeNotificationRepo(
  overrides: Partial<NotificationRepository> = {},
): NotificationRepository {
  return {
    getByPlayerAndLeague: async () => success([]),
    getByPlayerId: async () => success([]),
    markAsRead: async () => success(undefined),
    create: async () => success(undefined),
    ...overrides,
  };
}

/**
 * Build a WikimediaClient stub whose only exercised capability is
 * `pageviews.getArticleViews`. Defaults to a sub-2,000-view article, which
 * ADR 0003 legitimately prices at 0 — a safe default that never trips the
 * "not enough credits" guard regardless of the fixture team's balance.
 */
function makeWikimedia(
  averageViews30d: number | undefined = 2000,
): WikimediaClient {
  const unimplemented = () => {
    throw new Error("not implemented in stub");
  };
  return {
    pageviews: {
      getArticleViews: async () => ({
        latestDayViews: undefined,
        averageViews30d,
        weekViews: undefined,
        previousWeekViews: undefined,
        monthViews: undefined,
        yearViews: undefined,
      }),
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

function makeService(
  overrides: {
    contractRepo?: ContractRepository;
    leagueRepo?: LeagueRepository;
    teamRepo?: TeamRepository;
    playerRepo?: PlayerRepository;
    wikimedia?: WikimediaClient;
    notificationRepo?: NotificationRepository;
  } = {},
): ContractService {
  return new ContractService(
    {} as D1Database,
    overrides.contractRepo ?? makeContractRepo(),
    overrides.leagueRepo ?? makeLeagueRepo(),
    overrides.teamRepo ?? makeTeamRepo(),
    overrides.playerRepo ?? makePlayerRepo(),
    overrides.wikimedia ?? makeWikimedia(),
    overrides.notificationRepo ?? makeNotificationRepo(),
  );
}

// ─── getLeagueContracts ─────────────────────────────────────────────────────

describe("ContractService.getLeagueContracts", () => {
  it("propagates a failure from the contract repository", async () => {
    const service = makeService({
      contractRepo: makeContractRepo({
        getByLeagueId: async () => failure("contracts lookup failed"),
      }),
    });

    const result = await service.getLeagueContracts(LEAGUE_ID);

    expect(result).toEqual(failure("contracts lookup failed"));
  });
});

// ─── buyContract ────────────────────────────────────────────────────────────

describe("ContractService.buyContract", () => {
  it("creates the contract and returns credits debited by the server-side price", async () => {
    const views = 50_000;
    const expectedPrice = priceFor(views, TIER_DAYS.SHORT);
    // Guard the fixture: the debit is only meaningful if it's non-zero and
    // affordable from the starting balance.
    expect(expectedPrice).toBeGreaterThan(0);
    expect(expectedPrice).toBeLessThanOrEqual(team.credits);

    const service = makeService({ wikimedia: makeWikimedia(views) });

    const result = await service.buyContract(
      PLAYER_ID,
      LEAGUE_ID,
      "Some_Article",
      "SHORT",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Credits are derived (STARTING - Σpurchases + Σpayouts); the response
      // reports the pre-write snapshot minus this purchase without re-reading.
      expect(result.value.team.credits).toBe(team.credits - expectedPrice);
      expect(result.value.team.player).toEqual({
        id: PLAYER_ID,
        name: player.username,
      });
      expect(result.value.purchasePrice).toBe(expectedPrice);
    }
  });

  it("propagates a failure from the team repository", async () => {
    const service = makeService({
      teamRepo: makeTeamRepo(failure("team lookup failed")),
    });

    const result = await service.buyContract(
      PLAYER_ID,
      LEAGUE_ID,
      "Some_Article",
      "SHORT",
    );

    expect(result).toEqual(failure("team lookup failed"));
  });

  it("propagates a failure from the league repository", async () => {
    const service = makeService({
      leagueRepo: makeLeagueRepo(failure("league lookup failed")),
    });

    const result = await service.buyContract(
      PLAYER_ID,
      LEAGUE_ID,
      "Some_Article",
      "SHORT",
    );

    expect(result).toEqual(failure("league lookup failed"));
  });

  it("still completes the buy when the player lookup fails, falling back to an empty player name", async () => {
    const service = makeService({
      playerRepo: makePlayerRepo(failure("player lookup failed")),
    });

    const result = await service.buyContract(
      PLAYER_ID,
      LEAGUE_ID,
      "Some_Article",
      "SHORT",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.team.player).toEqual({ id: PLAYER_ID, name: "" });
    }
  });

  it("propagates a failure from the league contracts lookup", async () => {
    const service = makeService({
      contractRepo: makeContractRepo({
        getByLeagueId: async () => failure("league contracts lookup failed"),
      }),
    });

    const result = await service.buyContract(
      PLAYER_ID,
      LEAGUE_ID,
      "Some_Article",
      "SHORT",
    );

    expect(result).toEqual(failure("league contracts lookup failed"));
  });

  it("propagates a failure from the contract creation write", async () => {
    const service = makeService({
      contractRepo: makeContractRepo({
        create: async () => failure("insert failed"),
      }),
    });

    const result = await service.buyContract(
      PLAYER_ID,
      LEAGUE_ID,
      "Some_Article",
      "SHORT",
    );

    expect(result).toEqual(failure("insert failed"));
  });
});

// ─── sellContract ───────────────────────────────────────────────────────────

describe("ContractService.sellContract", () => {
  it("propagates a failure from the team repository", async () => {
    const service = makeService({
      teamRepo: makeTeamRepo(failure("team lookup failed")),
    });

    const result = await service.sellContract(
      PLAYER_ID,
      LEAGUE_ID,
      CONTRACT_ID,
    );

    expect(result).toEqual(failure("team lookup failed"));
  });

  it("fails with 'No team found for this league' when the player has no team there", async () => {
    const service = makeService({
      teamRepo: makeTeamRepo(success(null)),
    });

    const result = await service.sellContract(
      PLAYER_ID,
      LEAGUE_ID,
      CONTRACT_ID,
    );

    expect(result).toEqual(failure("No team found for this league"));
  });

  it("propagates a failure from the league repository", async () => {
    const service = makeService({
      leagueRepo: makeLeagueRepo(failure("league lookup failed")),
    });

    const result = await service.sellContract(
      PLAYER_ID,
      LEAGUE_ID,
      CONTRACT_ID,
    );

    expect(result).toEqual(failure("league lookup failed"));
  });

  it("still completes the sale when the player lookup fails, falling back to an empty player name", async () => {
    const service = makeService({
      playerRepo: makePlayerRepo(failure("player lookup failed")),
    });

    const result = await service.sellContract(
      PLAYER_ID,
      LEAGUE_ID,
      CONTRACT_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.team.player).toEqual({ id: PLAYER_ID, name: "" });
    }
  });

  it("propagates a failure from the contract repository", async () => {
    const service = makeService({
      contractRepo: makeContractRepo({
        getById: async () => failure("contract lookup failed"),
      }),
    });

    const result = await service.sellContract(
      PLAYER_ID,
      LEAGUE_ID,
      CONTRACT_ID,
    );

    expect(result).toEqual(failure("contract lookup failed"));
  });

  it("settles the contract and returns credits increased by the prorated payout", async () => {
    const today = Temporal.Now.plainDateISO();
    // tierDays = 10 (held), remainingDays = 7 — both fixed relative to today,
    // so the expected payout is deterministic regardless of the run date.
    const sellable = makeContract({
      purchaseDate: today.subtract({ days: 3 }),
      expireDate: today.add({ days: 7 }),
    });
    const views = 50_000;
    const price = priceFor(views, 10);
    const expectedPayout = Math.max(0, Math.round((price * 7) / 10));
    expect(expectedPayout).toBeGreaterThan(0);

    const service = makeService({
      wikimedia: makeWikimedia(views),
      contractRepo: makeContractRepo({
        getById: async () => success(sellable),
      }),
    });

    const result = await service.sellContract(
      PLAYER_ID,
      LEAGUE_ID,
      CONTRACT_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Credits are derived; the response reports the pre-write snapshot plus
      // this payout without re-reading the ledger.
      expect(result.value.team.credits).toBe(team.credits + expectedPayout);
      expect(result.value.team.player).toEqual({
        id: PLAYER_ID,
        name: player.username,
      });
    }
  });

  it("prices a same-day purchase/expiry contract (zero tier length) at a zero payout", async () => {
    const zeroTierContract = makeContract({
      purchaseDate: Temporal.PlainDate.from("2026-01-01"),
      expireDate: Temporal.PlainDate.from("2026-01-01"),
    });
    const service = makeService({
      contractRepo: makeContractRepo({
        getById: async () => success(zeroTierContract),
      }),
    });

    const result = await service.sellContract(
      PLAYER_ID,
      LEAGUE_ID,
      CONTRACT_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.purchasePrice).toBe(zeroTierContract.purchasePrice);
      expect(result.value.team.credits).toBe(team.credits);
    }
  });

  it("propagates a failure from the settlement write", async () => {
    const service = makeService({
      contractRepo: makeContractRepo({
        settleSale: async () => failure("settle failed"),
      }),
    });

    const result = await service.sellContract(
      PLAYER_ID,
      LEAGUE_ID,
      CONTRACT_ID,
    );

    expect(result).toEqual(failure("settle failed"));
  });

  it("fails with 'Contract already sold' when a concurrent sale wins the guarded write", async () => {
    const service = makeService({
      contractRepo: makeContractRepo({
        settleSale: async () => success(false),
      }),
    });

    const result = await service.sellContract(
      PLAYER_ID,
      LEAGUE_ID,
      CONTRACT_ID,
    );

    expect(result).toEqual(failure("Contract already sold"));
  });

  it("still returns the completed sale when the notification write fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const service = makeService({
      notificationRepo: makeNotificationRepo({
        create: async () => failure("notification insert failed"),
      }),
    });

    const result = await service.sellContract(
      PLAYER_ID,
      LEAGUE_ID,
      CONTRACT_ID,
    );

    expect(result.ok).toBe(true);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("notification insert failed"),
    );

    consoleError.mockRestore();
  });
});

// ─── getMyContracts ─────────────────────────────────────────────────────────

describe("ContractService.getMyContracts", () => {
  it("propagates a failure from the team repository", async () => {
    const service = makeService({
      teamRepo: makeTeamRepo(failure("team lookup failed")),
    });

    const result = await service.getMyContracts(PLAYER_ID, LEAGUE_ID);

    expect(result).toEqual(failure("team lookup failed"));
  });

  it("propagates a failure from the player repository", async () => {
    const service = makeService({
      playerRepo: makePlayerRepo(failure("player lookup failed")),
    });

    const result = await service.getMyContracts(PLAYER_ID, LEAGUE_ID);

    expect(result).toEqual(failure("player lookup failed"));
  });

  it("propagates a failure from the league repository", async () => {
    const service = makeService({
      leagueRepo: makeLeagueRepo(failure("league lookup failed")),
    });

    const result = await service.getMyContracts(PLAYER_ID, LEAGUE_ID);

    expect(result).toEqual(failure("league lookup failed"));
  });

  it("propagates a failure from the contracts lookup", async () => {
    const service = makeService({
      contractRepo: makeContractRepo({
        getByTeamId: async () => failure("contracts lookup failed"),
      }),
    });

    const result = await service.getMyContracts(PLAYER_ID, LEAGUE_ID);

    expect(result).toEqual(failure("contracts lookup failed"));
  });
});
