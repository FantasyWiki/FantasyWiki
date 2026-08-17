import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import { ContractService, CONTRACT_ERRORS } from "../../services/contract";
import { NotificationService } from "../../services/notification";
import { PlayerService } from "../../services/player";
import { TeamService } from "../../services/team";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import {
  ContractRepository,
  DueContract,
} from "../../repositories/contractRepository";
import { NotificationRepository } from "../../repositories/notificationRepository";
import { TeamRepository } from "../../repositories/teamRepository";
import { LeagueRepository } from "../../repositories/leagueRepository";
import { PlayerRepository } from "../../repositories/playerRepository";
import { success, failure, unwrap } from "../../repositories/result";
import { STARTING_CREDITS } from "../../../../model/team";
import type { Contract } from "../../../../model";
import {
  computeContractPrice,
  normalizedViews,
} from "../../../../model/pricing";
import { REFERENCE_SCALE } from "../../../../model/languageScale";
import { repositories } from "../support/target";
import { unusedWikimedia, wikimediaWithAvg } from "../support/wikimedia";

function priceFor(averageViews30d: number, tierDays: number): number {
  return computeContractPrice(
    normalizedViews(averageViews30d, REFERENCE_SCALE),
    tierDays,
  );
}

/** Repositories whose only exercised read fails. */
const failingTeamRepo = (error: string): TeamRepository =>
  ({
    getByPlayerAndLeague: async () => failure(error),
  }) as unknown as TeamRepository;

const failingLeagueRepo = (error: string): LeagueRepository =>
  ({ getById: async () => failure(error) }) as unknown as LeagueRepository;

const failingPlayerRepo = (error: string): PlayerRepository =>
  ({ getById: async () => failure(error) }) as unknown as PlayerRepository;

/** Records every notification the service attempts to write. */
function recordingNotificationRepo(sink: string[]): NotificationRepository {
  return {
    create: async (notification: { message: string }) => {
      sink.push(notification.message);
      return success(undefined);
    },
  } as unknown as NotificationRepository;
}

/**
 * The real D1 repository with individual methods swapped out, so a test can
 * force one guarded write to fail — or to lose its race and change no rows —
 * while every other read still goes to the database.
 */
function contractRepoOver(
  overrides: Partial<ContractRepository>,
): ContractRepository {
  const real = repositories().contracts;
  return {
    getByTeamId: (...args) => real.getByTeamId(...args),
    getById: (...args) => real.getById(...args),
    getByLeagueId: (...args) => real.getByLeagueId(...args),
    create: (...args) => real.create(...args),
    settleSale: (...args) => real.settleSale(...args),
    getDueForSettlement: (...args) => real.getDueForSettlement(...args),
    settleExpiry: (...args) => real.settleExpiry(...args),
    renew: (...args) => real.renew(...args),
    electRenewal: (...args) => real.electRenewal(...args),
    cancelRenewal: (...args) => real.cancelRenewal(...args),
    ...overrides,
  };
}

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

/**
 * The settled contract itself. What it *paid out* is not on it — `salePayout` is
 * a ledger column the derived balance sums (ADR 0007) — so tests read the payout
 * through `getDerivedCredits`.
 */
async function readContract(id: string): Promise<Contract> {
  const contract = unwrap(
    await repositories().contracts.getById(id),
    "contract read-back",
  );
  if (contract === null) throw new Error(`Contract ${id} disappeared`);
  return contract;
}

describe("ContractService settlement sweep Integration Tests", () => {
  let playerService: PlayerService;
  let leagueId: string;
  let playerId: string;
  let teamId: string;

  /**
   * Inserts an unsettled contract whose held tier is `tierDays` and whose
   * `expireDate` is `daysPastExpiry` days before today (default 0 = due today),
   * so it is picked up by the settlement sweep (`expireDate <= today`).
   */
  async function insertDueContract(opts: {
    tierDays: number;
    purchasePrice: number;
    daysPastExpiry?: number;
    renewalElected?: boolean;
    renewalCount?: number;
    articleId?: string;
    ownerTeamId?: string;
  }): Promise<Contract> {
    const owner = opts.ownerTeamId ?? teamId;
    const today = Temporal.Now.plainDateISO();
    const expireDate = today.subtract({ days: opts.daysPastExpiry ?? 0 });
    const purchaseDate = expireDate.subtract({ days: opts.tierDays });
    const contracts = repositories().contracts;

    const created = unwrap(
      await contracts.create({
        teamId: owner,
        articleId: opts.articleId ?? "Bitcoin",
        purchaseDate,
        expireDate,
        purchasePrice: opts.purchasePrice,
      }),
      "due contract",
    );

    // A renewal count is only reachable by actually renewing, so a contract on
    // its nth renewal is put there by n of them. Each rolls the window to the
    // same dates, leaving only the count changed.
    for (let renewal = 0; renewal < (opts.renewalCount ?? 0); renewal++) {
      unwrap(
        await contracts.electRenewal(created.id, owner),
        "election before renewal",
      );
      unwrap(
        await contracts.renew(
          created.id,
          purchaseDate,
          expireDate,
          opts.purchasePrice,
        ),
        "earlier renewal",
      );
    }

    if (opts.renewalElected) {
      unwrap(await contracts.electRenewal(created.id, owner), "election");
    }
    return readContract(created.id);
  }

  /** A far-future unsettled contract, held purely to drain derived credits. */
  async function insertCreditDrain(purchasePrice: number): Promise<void> {
    const today = Temporal.Now.plainDateISO();
    unwrap(
      await repositories().contracts.create({
        teamId,
        articleId: "Drain_Article",
        purchaseDate: today,
        expireDate: today.add({ days: 30 }),
        purchasePrice,
      }),
      "credit drain",
    );
  }

  /** Runs the whole sweep: fetch due contracts, settle/renew each. */
  async function runSweep(service: ContractService): Promise<void> {
    const today = Temporal.Now.plainDateISO();
    const dueResult = await service.getDueForSettlement(today);
    expect(dueResult.ok).toBe(true);
    if (!dueResult.ok) return;
    for (const contract of dueResult.value) {
      await service.settleDueContract(contract);
    }
  }

  beforeEach(async () => {
    playerService = new PlayerService(repositories());

    const playerResult = await playerService.createPlayer(
      "settletester",
      "settletester@example.com",
      "account-settle-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    // The Global League's domain is "en", which fixes every price below.
    leagueId = GLOBAL_LEAGUE_ID;
    teamId = unwrap(
      await new TeamService(repositories()).createTeam(
        playerId,
        leagueId,
        "Settle FC",
      ),
      "team",
    ).id;
  });

  it("settles an expired, non-renewed contract at a profit and notifies with the P&L", async () => {
    const tierDays = 7;
    const purchasePrice = 50;
    const contract = await insertDueContract({
      tierDays,
      purchasePrice,
      articleId: "Cristiano_Ronaldo",
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(120000),
    });
    await runSweep(service);

    const currentPrice = priceFor(120000, tierDays);
    const delta = currentPrice - purchasePrice;
    expect(delta).toBeGreaterThan(0);

    expect((await readContract(contract.id)).settled).toBe(true);

    // Credits = STARTING - purchasePrice + the payout, which is how much the
    // settlement paid: STARTING - purchasePrice + salePayout(settled).
    const credits = await getDerivedCredits(playerId, leagueId);
    expect(credits).toBe(STARTING_CREDITS - purchasePrice + currentPrice);

    const notifications = await new NotificationService(
      repositories(),
    ).getMyNotifications(playerId, leagueId);
    expect(notifications.ok).toBe(true);
    if (!notifications.ok) return;
    expect(notifications.value).toHaveLength(1);
    expect(notifications.value[0].message).toBe(
      `Cristiano Ronaldo settled at expiry: +${delta} credits`,
    );
    expect(notifications.value[0].contract.id).toBe(contract.id);
  });

  it("settles an expired, non-renewed contract at a loss with a negative-signed notification", async () => {
    const tierDays = 7;
    const purchasePrice = 800;
    const contract = await insertDueContract({
      tierDays,
      purchasePrice,
      articleId: "Bitcoin",
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(9000),
    });
    await runSweep(service);

    const currentPrice = priceFor(9000, tierDays);
    const delta = currentPrice - purchasePrice;
    expect(delta).toBeLessThan(0);

    expect((await readContract(contract.id)).settled).toBe(true);
    // A loss still pays out the live price, which the balance is what shows.
    expect(await getDerivedCredits(playerId, leagueId)).toBe(
      STARTING_CREDITS - purchasePrice + currentPrice,
    );

    const notifications = await new NotificationService(
      repositories(),
    ).getMyNotifications(playerId, leagueId);
    expect(notifications.ok).toBe(true);
    if (!notifications.ok) return;
    expect(notifications.value[0].message).toBe(
      `Bitcoin settled at expiry: −${Math.abs(delta)} credits`,
    );
  });

  it("renews an elected, affordable contract: rolls the window, bumps count, charges the premium", async () => {
    const tierDays = 7;
    const purchasePrice = 100;
    const renewalCount = 1;
    const before = await insertDueContract({
      tierDays,
      purchasePrice,
      renewalElected: true,
      renewalCount,
      articleId: "Ethereum",
    });

    const views = 9000;
    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(views),
    });
    await runSweep(service);

    const currentPrice = priceFor(views, tierDays);
    // renewalCount is renewals already done, so this sweep performs the
    // (renewalCount + 1)-th — that is what the +10% multiplies.
    const premium = Math.round(currentPrice * 0.1 * (renewalCount + 1));
    const newPurchasePrice = currentPrice + premium;
    // Affordability precondition for this scenario.
    expect(newPurchasePrice - purchasePrice).toBeLessThanOrEqual(
      STARTING_CREDITS - purchasePrice,
    );

    const after = await readContract(before.id);
    // Not settled — the position rolls forward.
    expect(after.settled).toBe(false);
    expect(after.renewalElected).toBe(false);
    expect(after.renewalCount).toBe(renewalCount + 1);
    expect(after.purchasePrice).toBe(newPurchasePrice);
    // Window rolled: purchaseDate <- old expireDate, expireDate += tierDays.
    expect(after.purchaseDate.toString()).toBe(before.expireDate.toString());
    expect(after.expireDate.toString()).toBe(
      before.expireDate.add({ days: tierDays }).toString(),
    );

    const notifications = await new NotificationService(
      repositories(),
    ).getMyNotifications(playerId, leagueId);
    expect(notifications.ok).toBe(true);
    if (!notifications.ok) return;
    expect(notifications.value[0].message).toBe(
      `Renewed Ethereum for ${tierDays} more days at ${newPurchasePrice} credits (+${premium} premium)`,
    );
  });

  it("charges the +10% premium on the very first renewal", async () => {
    // Regression: the premium used to multiply renewalCount directly, so a
    // contract renewing for the first time (renewalCount 0) was charged
    // nothing — the notification even read "(+0 premium)". Every other renewal
    // test seeded renewalCount >= 1, so nothing caught it. ADR 0003 charges
    // +10% per consecutive renewal, and the first renewal is one.
    const tierDays = 7;
    const contract = await insertDueContract({
      tierDays,
      purchasePrice: 100,
      renewalElected: true,
      renewalCount: 0,
      articleId: "Ethereum",
    });

    const views = 9000;
    await runSweep(
      new ContractService({
        ...repositories(),
        wikimedia: wikimediaWithAvg(views),
      }),
    );

    const currentPrice = priceFor(views, tierDays);
    const expectedPremium = Math.round(currentPrice * 0.1);
    expect(expectedPremium).toBeGreaterThan(0); // guard against a vacuous assertion

    const renewed = await readContract(contract.id);
    expect(renewed.renewalCount).toBe(1);
    expect(renewed.purchasePrice).toBe(currentPrice + expectedPremium);
  });

  it("settles instead of renewing when the elected renewal is unaffordable", async () => {
    const tierDays = 7;
    const purchasePrice = 0;
    // Drain credits so teamCredits is tiny, making the renewal unaffordable.
    await insertCreditDrain(STARTING_CREDITS - 10);
    const contract = await insertDueContract({
      tierDays,
      purchasePrice,
      renewalElected: true,
      renewalCount: 0,
      articleId: "Ethereum",
    });

    const views = 120000;
    const currentPrice = priceFor(views, tierDays);
    // Precondition: incremental cost (currentPrice - 0) exceeds the ~10 credits left.
    expect(currentPrice).toBeGreaterThan(10);

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(views),
    });
    await runSweep(service);

    const settled = await readContract(contract.id);
    // Fell through to settlement.
    expect(settled.settled).toBe(true);
    expect(settled.renewalElected).toBe(true); // untouched; only the settle path ran
    expect(settled.renewalCount).toBe(0);
    // Paid out the live price on top of the ~10 credits the drain left.
    expect(await getDerivedCredits(playerId, leagueId)).toBe(
      STARTING_CREDITS - (STARTING_CREDITS - 10) - purchasePrice + currentPrice,
    );

    const delta = currentPrice - purchasePrice;
    const notifications = await new NotificationService(
      repositories(),
    ).getMyNotifications(playerId, leagueId);
    expect(notifications.ok).toBe(true);
    if (!notifications.ok) return;
    expect(notifications.value[0].message).toBe(
      `Couldn't renew Ethereum (not enough credits) — settled at expiry: +${delta} credits`,
    );
  });

  it("is idempotent: a second sweep over already-settled contracts is a no-op", async () => {
    const tierDays = 7;
    const purchasePrice = 50;
    const contract = await insertDueContract({ tierDays, purchasePrice });

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(120000),
    });

    await runSweep(service);
    const creditsAfterFirst = await getDerivedCredits(playerId, leagueId);

    // Second sweep: getDueForSettlement no longer returns the settled row.
    const secondDue = await service.getDueForSettlement(
      Temporal.Now.plainDateISO(),
    );
    expect(secondDue.ok).toBe(true);
    if (secondDue.ok) {
      expect(secondDue.value.map((c) => c.id)).not.toContain(contract.id);
    }
    await runSweep(service);

    const creditsAfterSecond = await getDerivedCredits(playerId, leagueId);
    expect(creditsAfterSecond).toBe(creditsAfterFirst);

    // No duplicate notification.
    const notifications = await new NotificationService(
      repositories(),
    ).getMyNotifications(playerId, leagueId);
    expect(notifications.ok).toBe(true);
    if (notifications.ok) {
      expect(notifications.value).toHaveLength(1);
    }
  });

  it("re-picks (does not settle) a contract whose views fetch fails, so the sweep can retry later", async () => {
    const unpriceable = await insertDueContract({
      tierDays: 7,
      purchasePrice: 50,
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: wikimediaWithAvg(undefined),
    });

    const today = Temporal.Now.plainDateISO();
    const due = await service.getDueForSettlement(today);
    expect(due.ok).toBe(true);
    if (!due.ok) return;
    const contract = due.value.find((c) => c.id === unpriceable.id);
    expect(contract).toBeDefined();

    // Throws so the Workflow step retries; the contract stays unsettled.
    await expect(service.settleDueContract(contract!)).rejects.toThrow();

    expect((await readContract(unpriceable.id)).settled).toBe(false);
  });
});

describe("ContractService.electRenewal Integration Tests", () => {
  let playerService: PlayerService;
  let leagueId: string;
  let playerId: string;
  let teamId: string;

  async function insertContractExpiringIn(opts: {
    remainingDays: number;
    settled?: boolean;
    ownerTeamId?: string;
    articleId?: string;
  }): Promise<Contract> {
    const owner = opts.ownerTeamId ?? teamId;
    const today = Temporal.Now.plainDateISO();
    const tierDays = 7;
    const expireDate = today.add({ days: opts.remainingDays });
    const contracts = repositories().contracts;

    const created = unwrap(
      await contracts.create({
        teamId: owner,
        articleId: opts.articleId ?? "Bitcoin",
        purchaseDate: expireDate.subtract({ days: tierDays }),
        expireDate,
        purchasePrice: 100,
      }),
      "contract",
    );

    if (opts.settled) {
      unwrap(
        await contracts.settleSale(created.id, owner, 100),
        "sale that settled it",
      );
    }
    return readContract(created.id);
  }

  beforeEach(async () => {
    playerService = new PlayerService(repositories());

    const playerResult = await playerService.createPlayer(
      "electtester",
      "electtester@example.com",
      "account-elect-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    leagueId = GLOBAL_LEAGUE_ID;
    teamId = unwrap(
      await new TeamService(repositories()).createTeam(
        playerId,
        leagueId,
        "Elect FC",
      ),
      "team",
    ).id;
  });

  it("elects renewal for a contract inside the final-24h window", async () => {
    const contract = await insertContractExpiringIn({ remainingDays: 1 });

    const service = new ContractService({
      ...repositories(),
      wikimedia: unusedWikimedia(),
    });
    const result = await service.electRenewal(playerId, leagueId, contract.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.renewalElected).toBe(true);

    // Persisted, not just reported back.
    expect((await readContract(contract.id)).renewalElected).toBe(true);
  });

  it("rejects election that is too early (outside the final-24h window)", async () => {
    const contract = await insertContractExpiringIn({ remainingDays: 3 });

    const service = new ContractService({
      ...repositories(),
      wikimedia: unusedWikimedia(),
    });
    const result = await service.electRenewal(playerId, leagueId, contract.id);

    expect(result).toEqual({
      ok: false,
      error: "Renewal can only be elected in the final 24 hours before expiry",
    });
  });

  it("rejects election for an already-expired contract", async () => {
    const contract = await insertContractExpiringIn({ remainingDays: -1 });

    const service = new ContractService({
      ...repositories(),
      wikimedia: unusedWikimedia(),
    });
    const result = await service.electRenewal(playerId, leagueId, contract.id);

    expect(result).toEqual({
      ok: false,
      error: "Contract has already expired",
    });
  });

  it("rejects electing a contract owned by another team", async () => {
    const otherPlayer = await playerService.createPlayer(
      "electother",
      "electother@example.com",
      "account-elect-other-1",
    );
    expect(otherPlayer.ok).toBe(true);
    if (!otherPlayer.ok) return;
    const otherTeamId = unwrap(
      await new TeamService(repositories()).createTeam(
        otherPlayer.value.id,
        leagueId,
        "Other Elect FC",
      ),
      "other team",
    ).id;
    const contract = await insertContractExpiringIn({
      remainingDays: 1,
      ownerTeamId: otherTeamId,
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: unusedWikimedia(),
    });
    const result = await service.electRenewal(playerId, leagueId, contract.id);

    expect(result).toEqual({
      ok: false,
      error: "You do not own this contract",
    });
  });

  it("rejects electing an already-settled contract", async () => {
    const contract = await insertContractExpiringIn({
      remainingDays: 1,
      settled: true,
    });

    const service = new ContractService({
      ...repositories(),
      wikimedia: unusedWikimedia(),
    });
    const result = await service.electRenewal(playerId, leagueId, contract.id);

    expect(result).toEqual({
      ok: false,
      error: "Contract already settled",
    });
  });

  it("rejects electing a contract that does not exist", async () => {
    const service = new ContractService({
      ...repositories(),
      wikimedia: unusedWikimedia(),
    });
    const result = await service.electRenewal(playerId, leagueId, "no-such-id");

    expect(result).toEqual({
      ok: false,
      error: CONTRACT_ERRORS.CONTRACT_NOT_FOUND,
    });
  });

  it("rejects electing when the player has no team in the league", async () => {
    const outsider = await playerService.createPlayer(
      "electoutsider",
      "electoutsider@example.com",
      "account-elect-outsider-1",
    );
    expect(outsider.ok).toBe(true);
    if (!outsider.ok) return;
    const contract = await insertContractExpiringIn({ remainingDays: 1 });

    const service = new ContractService({
      ...repositories(),
      wikimedia: unusedWikimedia(),
    });
    const result = await service.electRenewal(
      outsider.value.id,
      leagueId,
      contract.id,
    );

    expect(result).toEqual({ ok: false, error: CONTRACT_ERRORS.NO_TEAM });
  });

  /**
   * The election is a guarded write, so it can lose a race with the settlement
   * sweep that ran between the read and the write. Zero rows changed is not
   * "already elected" — the contract is simply no longer electable.
   */
  it("rejects the election when the guarded write finds no electable row", async () => {
    const contract = await insertContractExpiringIn({ remainingDays: 1 });
    const contractRepo = contractRepoOver({
      electRenewal: async () => success(false),
    });

    const service = new ContractService({
      ...repositories(),
      contracts: contractRepo,
      wikimedia: unusedWikimedia(),
    });
    const result = await service.electRenewal(playerId, leagueId, contract.id);

    expect(result).toEqual({
      ok: false,
      error: CONTRACT_ERRORS.CONTRACT_NOT_FOUND,
    });
  });

  it("propagates a failure to read the contract", async () => {
    const contractRepo = contractRepoOver({
      getById: async () => failure("Error fetching contract: D1 unavailable"),
    });

    const service = new ContractService({
      ...repositories(),
      contracts: contractRepo,
      wikimedia: unusedWikimedia(),
    });
    const result = await service.electRenewal(
      playerId,
      leagueId,
      "contract-elect-anything",
    );

    expect(result).toEqual({
      ok: false,
      error: "Error fetching contract: D1 unavailable",
    });
  });

  it("propagates a failure from the guarded election write", async () => {
    const contract = await insertContractExpiringIn({ remainingDays: 1 });
    const contractRepo = contractRepoOver({
      electRenewal: async () => failure("Error electing contract renewal"),
    });

    const service = new ContractService({
      ...repositories(),
      contracts: contractRepo,
      wikimedia: unusedWikimedia(),
    });
    const result = await service.electRenewal(playerId, leagueId, contract.id);

    expect(result).toEqual({
      ok: false,
      error: "Error electing contract renewal",
    });
  });

  it("propagates a failure to read the team", async () => {
    const service = new ContractService({
      ...repositories(),
      teams: failingTeamRepo("Error retrieving team"),
      wikimedia: unusedWikimedia(),
    });

    const result = await service.electRenewal(playerId, leagueId, "contract-x");

    expect(result).toEqual({ ok: false, error: "Error retrieving team" });
  });

  it("propagates a failure to read the league", async () => {
    const service = new ContractService({
      ...repositories(),
      leagues: failingLeagueRepo("Error retrieving league"),
      wikimedia: unusedWikimedia(),
    });

    const result = await service.electRenewal(playerId, leagueId, "contract-x");

    expect(result).toEqual({ ok: false, error: "Error retrieving league" });
  });

  /**
   * The player name is cosmetic on the returned DTO — the election itself has
   * already been written — so a failed player lookup must not fail the call.
   */
  it("still elects when the player lookup fails, leaving the name blank", async () => {
    const contract = await insertContractExpiringIn({ remainingDays: 1 });

    const service = new ContractService({
      ...repositories(),
      players: failingPlayerRepo("Error retrieving player"),
      wikimedia: unusedWikimedia(),
    });
    const result = await service.electRenewal(playerId, leagueId, contract.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.renewalElected).toBe(true);
    expect(result.value.team.player.name).toBe("");
  });
});

/**
 * Renewal guards that need a real team/contract in D1, plus the failure modes
 * of the sweep's own writes. `settleDueContract` throws rather than returns on
 * a write failure — that is the contract with the Workflow, whose step retries
 * on a thrown error and would otherwise mark a failed settlement as done.
 */
describe("ContractService cancelRenewal guards and settlement failure modes", () => {
  let playerService: PlayerService;
  let leagueId: string;
  let playerId: string;
  let teamId: string;

  function dueContract(overrides: Partial<DueContract> = {}): DueContract {
    const expireDate = Temporal.Now.plainDateISO();
    return {
      id: "contract-due-1",
      teamId,
      articleId: "Bitcoin",
      purchaseDate: expireDate.subtract({ days: 7 }),
      expireDate,
      purchasePrice: 100,
      settled: false,
      renewalCount: 0,
      renewalElected: false,
      domain: "en",
      languageScale: REFERENCE_SCALE,
      teamCredits: STARTING_CREDITS,
      ...overrides,
    };
  }

  beforeEach(async () => {
    playerService = new PlayerService(repositories());

    const playerResult = await playerService.createPlayer(
      "guardtester",
      "guardtester@example.com",
      "account-guard-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    leagueId = GLOBAL_LEAGUE_ID;
    teamId = unwrap(
      await new TeamService(repositories()).createTeam(
        playerId,
        leagueId,
        "Guard FC",
      ),
      "team",
    ).id;
  });

  /** A contract whose owner has already elected renewal at expiry. */
  async function insertElectedContract(
    articleId = "Bitcoin",
    owner?: string,
  ): Promise<Contract> {
    const holder = owner ?? teamId;
    const today = Temporal.Now.plainDateISO();
    const contracts = repositories().contracts;

    const created = unwrap(
      await contracts.create({
        teamId: holder,
        articleId,
        purchaseDate: today.subtract({ days: 7 }),
        expireDate: today.add({ days: 1 }),
        purchasePrice: 100,
      }),
      "contract",
    );
    unwrap(
      await contracts.electRenewal(created.id, holder),
      "renewal election",
    );
    return readContract(created.id);
  }

  it("rejects cancelling a contract that does not exist", async () => {
    const result = await new ContractService({
      ...repositories(),
      wikimedia: unusedWikimedia(),
    }).cancelRenewal(playerId, leagueId, "no-such-id");

    expect(result).toEqual({
      ok: false,
      error: CONTRACT_ERRORS.CONTRACT_NOT_FOUND,
    });
  });

  it("rejects cancelling when the player has no team in the league", async () => {
    const outsider = await playerService.createPlayer(
      "guardoutsider",
      "guardoutsider@example.com",
      "account-guard-outsider-1",
    );
    expect(outsider.ok).toBe(true);
    if (!outsider.ok) return;
    const contract = await insertElectedContract();

    const result = await new ContractService({
      ...repositories(),
      wikimedia: unusedWikimedia(),
    }).cancelRenewal(outsider.value.id, leagueId, contract.id);

    expect(result).toEqual({ ok: false, error: CONTRACT_ERRORS.NO_TEAM });
  });

  it("rejects cancelling a contract owned by another team", async () => {
    const rival = await playerService.createPlayer(
      "guardrival",
      "guardrival@example.com",
      "account-guard-rival-1",
    );
    expect(rival.ok).toBe(true);
    if (!rival.ok) return;
    const rivalTeamId = unwrap(
      await new TeamService(repositories()).createTeam(
        rival.value.id,
        leagueId,
        "Rival Guard FC",
      ),
      "rival team",
    ).id;
    const rivalContract = await insertElectedContract("Bitcoin", rivalTeamId);

    const result = await new ContractService({
      ...repositories(),
      wikimedia: unusedWikimedia(),
    }).cancelRenewal(playerId, leagueId, rivalContract.id);

    expect(result).toEqual({
      ok: false,
      error: CONTRACT_ERRORS.NOT_CONTRACT_OWNER,
    });
  });

  /**
   * The row was elected when the service read it but is not any more: the sweep
   * renewed it in between, clearing the flag. The withdrawal has to lose that
   * race rather than silently un-electing an already-renewed contract.
   */
  it("rejects the withdrawal when the sweep renewed the contract first", async () => {
    const contract = await insertElectedContract();
    const contractRepo = contractRepoOver({
      cancelRenewal: async () => success(false),
    });

    const result = await new ContractService({
      ...repositories(),
      contracts: contractRepo,
      wikimedia: unusedWikimedia(),
    }).cancelRenewal(playerId, leagueId, contract.id);

    expect(result).toEqual({
      ok: false,
      error: CONTRACT_ERRORS.RENEWAL_NOT_ELECTED,
    });
  });

  it("propagates a failure from the guarded withdrawal write", async () => {
    const contract = await insertElectedContract();
    const contractRepo = contractRepoOver({
      cancelRenewal: async () => failure("Error cancelling contract renewal"),
    });

    const result = await new ContractService({
      ...repositories(),
      contracts: contractRepo,
      wikimedia: unusedWikimedia(),
    }).cancelRenewal(playerId, leagueId, contract.id);

    expect(result).toEqual({
      ok: false,
      error: "Error cancelling contract renewal",
    });
  });

  it("propagates a failure to read the team", async () => {
    const service = new ContractService({
      ...repositories(),
      teams: failingTeamRepo("Error retrieving team"),
      wikimedia: unusedWikimedia(),
    });

    const result = await service.cancelRenewal(playerId, leagueId, "any");

    expect(result).toEqual({ ok: false, error: "Error retrieving team" });
  });

  it("propagates a failure to read the league", async () => {
    const service = new ContractService({
      ...repositories(),
      leagues: failingLeagueRepo("Error retrieving league"),
      wikimedia: unusedWikimedia(),
    });

    const result = await service.cancelRenewal(playerId, leagueId, "any");

    expect(result).toEqual({ ok: false, error: "Error retrieving league" });
  });

  it("propagates a failure to read the contract", async () => {
    const contractRepo = contractRepoOver({
      getById: async () => failure("Error fetching contract"),
    });

    const result = await new ContractService({
      ...repositories(),
      contracts: contractRepo,
      wikimedia: unusedWikimedia(),
    }).cancelRenewal(playerId, leagueId, "any");

    expect(result).toEqual({ ok: false, error: "Error fetching contract" });
  });

  /**
   * A re-run of the sweep over a contract a previous run already resolved must
   * be silent: the guarded write changes no rows, and notifying again would
   * tell the player twice that the same contract was settled or renewed.
   */
  it("does not notify when the settlement write finds the contract already settled", async () => {
    const messages: string[] = [];
    const contractRepo = contractRepoOver({
      settleExpiry: async () => success(false),
    });
    const service = new ContractService({
      ...repositories(),
      contracts: contractRepo,
      notifications: recordingNotificationRepo(messages),
      wikimedia: wikimediaWithAvg(120000),
    });

    await service.settleDueContract(dueContract());

    expect(messages).toEqual([]);
  });

  it("does not notify when the renewal write finds the contract already renewed", async () => {
    const messages: string[] = [];
    const contractRepo = contractRepoOver({
      renew: async () => success(false),
    });
    const service = new ContractService({
      ...repositories(),
      contracts: contractRepo,
      notifications: recordingNotificationRepo(messages),
      wikimedia: wikimediaWithAvg(9000),
    });

    await service.settleDueContract(dueContract({ renewalElected: true }));

    expect(messages).toEqual([]);
  });

  it("throws when the expiry settlement write fails, so the sweep step retries", async () => {
    const contractRepo = contractRepoOver({
      settleExpiry: async () => failure("Error settling contract at expiry"),
    });
    const service = new ContractService({
      ...repositories(),
      contracts: contractRepo,
      wikimedia: wikimediaWithAvg(120000),
    });

    await expect(service.settleDueContract(dueContract())).rejects.toThrow(
      "Error settling contract at expiry",
    );
  });

  it("throws when the renewal write fails, so the sweep step retries", async () => {
    const contractRepo = contractRepoOver({
      renew: async () => failure("Error renewing contract"),
    });
    const service = new ContractService({
      ...repositories(),
      contracts: contractRepo,
      wikimedia: wikimediaWithAvg(9000),
    });

    await expect(
      service.settleDueContract(dueContract({ renewalElected: true })),
    ).rejects.toThrow("Error renewing contract");
  });

  /**
   * The money write has already landed by the time the notification is written,
   * and the settlement is idempotent — so a failed notification must not throw
   * the step into a retry that would re-do nothing.
   */
  it("settles even when the notification cannot be written", async () => {
    const today = Temporal.Now.plainDateISO();
    const contract = unwrap(
      await repositories().contracts.create({
        teamId,
        articleId: "Bitcoin",
        purchaseDate: today.subtract({ days: 7 }),
        expireDate: today,
        purchasePrice: 100,
      }),
      "due contract",
    );

    const notificationRepo = {
      create: async () => failure("Error creating notification"),
    } as unknown as NotificationRepository;
    const service = new ContractService({
      ...repositories(),
      notifications: notificationRepo,
      wikimedia: wikimediaWithAvg(120000),
    });

    await expect(
      service.settleDueContract(dueContract({ id: contract.id })),
    ).resolves.toBeUndefined();

    expect((await readContract(contract.id)).settled).toBe(true);
    // The money write landed: the payout shows up on the derived balance.
    expect(await getDerivedCredits(playerId, leagueId)).toBe(
      STARTING_CREDITS - 100 + priceFor(120000, 7),
    );
  });
});
