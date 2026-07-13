import { env } from "cloudflare:workers";
import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import { ContractService, CONTRACT_ERRORS } from "../../services/contract";
import { NotificationService } from "../../services/notification";
import { PlayerService } from "../../services/player";
import { TeamRepositoryD1 } from "../../repositories/d1/teamRepositoryD1";
import { ContractRepositoryD1 } from "../../repositories/d1/contractRepositoryD1";
import {
  ContractRepository,
  DueContract,
} from "../../repositories/contractRepository";
import { NotificationRepository } from "../../repositories/notificationRepository";
import { TeamRepository } from "../../repositories/teamRepository";
import { LeagueRepository } from "../../repositories/leagueRepository";
import { PlayerRepository } from "../../repositories/playerRepository";
import { success, failure } from "../../repositories/result";
import { WikimediaClient } from "../../../../external-apis/wikimedia/client";
import { STARTING_CREDITS } from "../../../../model/team";
import {
  computeContractPrice,
  normalizedViews,
  resolveLanguageScale,
} from "../../../../model/pricing";
import { insertTeam } from "../utils/d1TestUtils";

/**
 * WikimediaClient stub exposing only `pageviews.getArticleViews`, the sole
 * capability the settlement sweep exercises; everything else throws so an
 * accidental dependency fails loudly. Mirrors the helper in
 * contract.integration.test.ts.
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

function wikimediaWithAvg(
  averageViews30d: number | undefined,
): WikimediaClient {
  return wikimediaClientWithArticleViews(async () => ({
    latestDayViews: undefined,
    averageViews30d,
    weekViews: undefined,
    previousWeekViews: undefined,
    monthViews: undefined,
    yearViews: undefined,
  }));
}

function priceFor(averageViews30d: number, tierDays: number): number {
  return computeContractPrice(
    normalizedViews(averageViews30d, resolveLanguageScale("en")),
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
  db: D1Database,
  overrides: Partial<ContractRepository>,
): ContractRepository {
  const real = new ContractRepositoryD1(db);
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
  const result = await new TeamRepositoryD1(env.db).getByPlayerAndLeague(
    playerId,
    leagueId,
  );
  if (!result.ok || result.value === null) return null;
  return result.value.credits;
}

async function readContractRow(id: string) {
  return env.db.prepare("SELECT * FROM contracts WHERE id = ?").bind(id).first<{
    purchaseDate: string;
    expireDate: string;
    purchasePrice: number;
    settled: number;
    salePayout: number | null;
    renewalCount: number;
    renewalElected: number;
  }>();
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
    id: string;
    tierDays: number;
    purchasePrice: number;
    daysPastExpiry?: number;
    renewalElected?: boolean;
    renewalCount?: number;
    articleId?: string;
    ownerTeamId?: string;
  }): Promise<void> {
    const today = Temporal.Now.plainDateISO();
    const expireDate = today.subtract({ days: opts.daysPastExpiry ?? 0 });
    const purchaseDate = expireDate.subtract({ days: opts.tierDays });
    await env.db
      .prepare(
        `INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice, renewalElected, renewalCount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        opts.id,
        opts.ownerTeamId ?? teamId,
        opts.articleId ?? "Bitcoin",
        purchaseDate.toString(),
        expireDate.toString(),
        opts.purchasePrice,
        opts.renewalElected ? 1 : 0,
        opts.renewalCount ?? 0,
      )
      .run();
  }

  /** Insert a far-future unsettled contract purely to drain derived credits. */
  async function insertCreditDrain(purchasePrice: number): Promise<void> {
    const today = Temporal.Now.plainDateISO();
    await env.db
      .prepare(
        "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "contract-drain",
        teamId,
        "Drain_Article",
        today.toString(),
        today.add({ days: 30 }).toString(),
        purchasePrice,
      )
      .run();
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
    playerService = new PlayerService(env.db);

    const playerResult = await playerService.createPlayer(
      "settletester",
      "settletester@example.com",
      "account-settle-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    leagueId = "league-settle-1";
    await env.db
      .prepare(
        `INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        leagueId,
        "Settle League",
        playerId,
        new Date().toISOString(),
        new Date().toISOString(),
        "en",
        "🏆",
      )
      .run();

    teamId = "team-settle-1";
    await insertTeam(env.db, {
      id: teamId,
      name: "Settle FC",
      playerId,
      leagueId,
    });
  });

  it("settles an expired, non-renewed contract at a profit and notifies with the P&L", async () => {
    const tierDays = 7;
    const purchasePrice = 50;
    await insertDueContract({
      id: "contract-profit",
      tierDays,
      purchasePrice,
      articleId: "Cristiano_Ronaldo",
    });

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(120000),
    );
    await runSweep(service);

    const currentPrice = priceFor(120000, tierDays);
    const delta = currentPrice - purchasePrice;
    expect(delta).toBeGreaterThan(0);

    const row = await readContractRow("contract-profit");
    expect(row?.settled).toBe(1);
    expect(row?.salePayout).toBe(currentPrice);

    // Credits = STARTING - purchasePrice + salePayout(settled).
    const credits = await getDerivedCredits(playerId, leagueId);
    expect(credits).toBe(STARTING_CREDITS - purchasePrice + currentPrice);

    const notifications = await new NotificationService(
      env.db,
    ).getMyNotifications(playerId, leagueId);
    expect(notifications.ok).toBe(true);
    if (!notifications.ok) return;
    expect(notifications.value).toHaveLength(1);
    expect(notifications.value[0].message).toBe(
      `Cristiano Ronaldo settled at expiry: +${delta} credits`,
    );
    expect(notifications.value[0].contract.id).toBe("contract-profit");
  });

  it("settles an expired, non-renewed contract at a loss with a negative-signed notification", async () => {
    const tierDays = 7;
    const purchasePrice = 800;
    await insertDueContract({
      id: "contract-loss",
      tierDays,
      purchasePrice,
      articleId: "Bitcoin",
    });

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
    );
    await runSweep(service);

    const currentPrice = priceFor(9000, tierDays);
    const delta = currentPrice - purchasePrice;
    expect(delta).toBeLessThan(0);

    const row = await readContractRow("contract-loss");
    expect(row?.settled).toBe(1);
    expect(row?.salePayout).toBe(currentPrice);

    const notifications = await new NotificationService(
      env.db,
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
    await insertDueContract({
      id: "contract-renew",
      tierDays,
      purchasePrice,
      renewalElected: true,
      renewalCount,
      articleId: "Ethereum",
    });
    const oldRow = await readContractRow("contract-renew");

    const views = 9000;
    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(views),
    );
    await runSweep(service);

    const currentPrice = priceFor(views, tierDays);
    const premium = Math.round(currentPrice * 0.1 * renewalCount);
    const newPurchasePrice = currentPrice + premium;
    // Affordability precondition for this scenario.
    expect(newPurchasePrice - purchasePrice).toBeLessThanOrEqual(
      STARTING_CREDITS - purchasePrice,
    );

    const row = await readContractRow("contract-renew");
    // Not settled — the position rolls forward.
    expect(row?.settled).toBe(0);
    expect(row?.renewalElected).toBe(0);
    expect(row?.renewalCount).toBe(renewalCount + 1);
    expect(row?.purchasePrice).toBe(newPurchasePrice);
    // Window rolled: purchaseDate <- old expireDate, expireDate += tierDays.
    expect(row?.purchaseDate).toBe(oldRow?.expireDate);
    expect(row?.expireDate).toBe(
      Temporal.PlainDate.from(oldRow!.expireDate)
        .add({ days: tierDays })
        .toString(),
    );

    const notifications = await new NotificationService(
      env.db,
    ).getMyNotifications(playerId, leagueId);
    expect(notifications.ok).toBe(true);
    if (!notifications.ok) return;
    expect(notifications.value[0].message).toBe(
      `Renewed Ethereum for ${tierDays} more days at ${newPurchasePrice} credits (+${premium} premium)`,
    );
  });

  it("settles instead of renewing when the elected renewal is unaffordable", async () => {
    const tierDays = 7;
    const purchasePrice = 0;
    // Drain credits so teamCredits is tiny, making the renewal unaffordable.
    await insertCreditDrain(STARTING_CREDITS - 10);
    await insertDueContract({
      id: "contract-renew-broke",
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

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(views),
    );
    await runSweep(service);

    const row = await readContractRow("contract-renew-broke");
    // Fell through to settlement.
    expect(row?.settled).toBe(1);
    expect(row?.salePayout).toBe(currentPrice);
    expect(row?.renewalElected).toBe(1); // untouched; only the sweep's settle path ran
    expect(row?.renewalCount).toBe(0);

    const delta = currentPrice - purchasePrice;
    const notifications = await new NotificationService(
      env.db,
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
    await insertDueContract({
      id: "contract-idem",
      tierDays,
      purchasePrice,
    });

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(120000),
    );

    await runSweep(service);
    const creditsAfterFirst = await getDerivedCredits(playerId, leagueId);

    // Second sweep: getDueForSettlement no longer returns the settled row.
    const secondDue = await service.getDueForSettlement(
      Temporal.Now.plainDateISO(),
    );
    expect(secondDue.ok).toBe(true);
    if (secondDue.ok) {
      expect(secondDue.value.map((c) => c.id)).not.toContain("contract-idem");
    }
    await runSweep(service);

    const creditsAfterSecond = await getDerivedCredits(playerId, leagueId);
    expect(creditsAfterSecond).toBe(creditsAfterFirst);

    // No duplicate notification.
    const notifications = await new NotificationService(
      env.db,
    ).getMyNotifications(playerId, leagueId);
    expect(notifications.ok).toBe(true);
    if (notifications.ok) {
      expect(notifications.value).toHaveLength(1);
    }
  });

  it("re-picks (does not settle) a contract whose views fetch fails, so the sweep can retry later", async () => {
    await insertDueContract({
      id: "contract-noviews",
      tierDays: 7,
      purchasePrice: 50,
    });

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(undefined),
    );

    const today = Temporal.Now.plainDateISO();
    const due = await service.getDueForSettlement(today);
    expect(due.ok).toBe(true);
    if (!due.ok) return;
    const contract = due.value.find((c) => c.id === "contract-noviews");
    expect(contract).toBeDefined();

    // Throws so the Workflow step retries; the row stays unsettled.
    await expect(service.settleDueContract(contract!)).rejects.toThrow();

    const row = await readContractRow("contract-noviews");
    expect(row?.settled).toBe(0);
  });
});

describe("ContractService.electRenewal Integration Tests", () => {
  let playerService: PlayerService;
  let leagueId: string;
  let playerId: string;
  let teamId: string;

  async function insertContractExpiringIn(opts: {
    id: string;
    remainingDays: number;
    settled?: boolean;
    ownerTeamId?: string;
  }): Promise<void> {
    const today = Temporal.Now.plainDateISO();
    const tierDays = 7;
    const expireDate = today.add({ days: opts.remainingDays });
    const purchaseDate = expireDate.subtract({ days: tierDays });
    await env.db
      .prepare(
        `INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice, settled)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        opts.id,
        opts.ownerTeamId ?? teamId,
        "Bitcoin",
        purchaseDate.toString(),
        expireDate.toString(),
        100,
        opts.settled ? 1 : 0,
      )
      .run();
  }

  beforeEach(async () => {
    playerService = new PlayerService(env.db);

    const playerResult = await playerService.createPlayer(
      "electtester",
      "electtester@example.com",
      "account-elect-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    leagueId = "league-elect-1";
    await env.db
      .prepare(
        `INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        leagueId,
        "Elect League",
        playerId,
        new Date().toISOString(),
        new Date().toISOString(),
        "en",
        "🏆",
      )
      .run();

    teamId = "team-elect-1";
    await insertTeam(env.db, {
      id: teamId,
      name: "Elect FC",
      playerId,
      leagueId,
    });
  });

  it("elects renewal for a contract inside the final-24h window", async () => {
    await insertContractExpiringIn({
      id: "contract-elect-ok",
      remainingDays: 1,
    });

    const service = new ContractService(env.db);
    const result = await service.electRenewal(
      playerId,
      leagueId,
      "contract-elect-ok",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.renewalElected).toBe(true);

    const row = await env.db
      .prepare("SELECT renewalElected FROM contracts WHERE id = ?")
      .bind("contract-elect-ok")
      .first<{ renewalElected: number }>();
    expect(row?.renewalElected).toBe(1);
  });

  it("rejects election that is too early (outside the final-24h window)", async () => {
    await insertContractExpiringIn({
      id: "contract-elect-early",
      remainingDays: 3,
    });

    const service = new ContractService(env.db);
    const result = await service.electRenewal(
      playerId,
      leagueId,
      "contract-elect-early",
    );

    expect(result).toEqual({
      ok: false,
      error: "Renewal can only be elected in the final 24 hours before expiry",
    });
  });

  it("rejects election for an already-expired contract", async () => {
    await insertContractExpiringIn({
      id: "contract-elect-expired",
      remainingDays: -1,
    });

    const service = new ContractService(env.db);
    const result = await service.electRenewal(
      playerId,
      leagueId,
      "contract-elect-expired",
    );

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
    const otherTeamId = "team-elect-other-1";
    await insertTeam(env.db, {
      id: otherTeamId,
      name: "Other Elect FC",
      playerId: otherPlayer.value.id,
      leagueId,
    });
    await insertContractExpiringIn({
      id: "contract-elect-other",
      remainingDays: 1,
      ownerTeamId: otherTeamId,
    });

    const service = new ContractService(env.db);
    const result = await service.electRenewal(
      playerId,
      leagueId,
      "contract-elect-other",
    );

    expect(result).toEqual({
      ok: false,
      error: "You do not own this contract",
    });
  });

  it("rejects electing an already-settled contract", async () => {
    await insertContractExpiringIn({
      id: "contract-elect-settled",
      remainingDays: 1,
      settled: true,
    });

    const service = new ContractService(env.db);
    const result = await service.electRenewal(
      playerId,
      leagueId,
      "contract-elect-settled",
    );

    expect(result).toEqual({
      ok: false,
      error: "Contract already settled",
    });
  });

  it("rejects electing a contract that does not exist", async () => {
    const service = new ContractService(env.db);
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
    await insertContractExpiringIn({
      id: "contract-elect-noteam",
      remainingDays: 1,
    });

    const service = new ContractService(env.db);
    const result = await service.electRenewal(
      outsider.value.id,
      leagueId,
      "contract-elect-noteam",
    );

    expect(result).toEqual({ ok: false, error: CONTRACT_ERRORS.NO_TEAM });
  });

  /**
   * The election is a guarded write, so it can lose a race with the settlement
   * sweep that ran between the read and the write. Zero rows changed is not
   * "already elected" — the contract is simply no longer electable.
   */
  it("rejects the election when the guarded write finds no electable row", async () => {
    await insertContractExpiringIn({
      id: "contract-elect-race",
      remainingDays: 1,
    });
    const contractRepo = contractRepoOver(env.db, {
      electRenewal: async () => success(false),
    });

    const service = new ContractService(env.db, contractRepo);
    const result = await service.electRenewal(
      playerId,
      leagueId,
      "contract-elect-race",
    );

    expect(result).toEqual({
      ok: false,
      error: CONTRACT_ERRORS.CONTRACT_NOT_FOUND,
    });
  });

  it("propagates a failure to read the contract", async () => {
    const contractRepo = contractRepoOver(env.db, {
      getById: async () => failure("Error fetching contract: D1 unavailable"),
    });

    const service = new ContractService(env.db, contractRepo);
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
    await insertContractExpiringIn({
      id: "contract-elect-writefail",
      remainingDays: 1,
    });
    const contractRepo = contractRepoOver(env.db, {
      electRenewal: async () => failure("Error electing contract renewal"),
    });

    const service = new ContractService(env.db, contractRepo);
    const result = await service.electRenewal(
      playerId,
      leagueId,
      "contract-elect-writefail",
    );

    expect(result).toEqual({
      ok: false,
      error: "Error electing contract renewal",
    });
  });

  it("propagates a failure to read the team", async () => {
    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      failingTeamRepo("Error retrieving team"),
    );

    const result = await service.electRenewal(playerId, leagueId, "contract-x");

    expect(result).toEqual({ ok: false, error: "Error retrieving team" });
  });

  it("propagates a failure to read the league", async () => {
    const service = new ContractService(
      env.db,
      undefined,
      failingLeagueRepo("Error retrieving league"),
    );

    const result = await service.electRenewal(playerId, leagueId, "contract-x");

    expect(result).toEqual({ ok: false, error: "Error retrieving league" });
  });

  /**
   * The player name is cosmetic on the returned DTO — the election itself has
   * already been written — so a failed player lookup must not fail the call.
   */
  it("still elects when the player lookup fails, leaving the name blank", async () => {
    await insertContractExpiringIn({
      id: "contract-elect-noplayer",
      remainingDays: 1,
    });

    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      failingPlayerRepo("Error retrieving player"),
    );
    const result = await service.electRenewal(
      playerId,
      leagueId,
      "contract-elect-noplayer",
    );

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
      teamCredits: STARTING_CREDITS,
      ...overrides,
    };
  }

  beforeEach(async () => {
    playerService = new PlayerService(env.db);

    const playerResult = await playerService.createPlayer(
      "guardtester",
      "guardtester@example.com",
      "account-guard-1",
    );
    expect(playerResult.ok).toBe(true);
    if (!playerResult.ok) throw new Error("setup failed: player");
    playerId = playerResult.value.id;

    leagueId = "league-guard-1";
    await env.db
      .prepare(
        `INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        leagueId,
        "Guard League",
        playerId,
        new Date().toISOString(),
        new Date().toISOString(),
        "en",
        "🏆",
      )
      .run();

    teamId = "team-guard-1";
    await insertTeam(env.db, {
      id: teamId,
      name: "Guard FC",
      playerId,
      leagueId,
    });
  });

  async function insertElectedContract(id: string): Promise<void> {
    const today = Temporal.Now.plainDateISO();
    await env.db
      .prepare(
        `INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice, renewalElected)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
      )
      .bind(
        id,
        teamId,
        "Bitcoin",
        today.subtract({ days: 7 }).toString(),
        today.add({ days: 1 }).toString(),
        100,
      )
      .run();
  }

  it("rejects cancelling a contract that does not exist", async () => {
    const result = await new ContractService(env.db).cancelRenewal(
      playerId,
      leagueId,
      "no-such-id",
    );

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
    await insertElectedContract("contract-guard-noteam");

    const result = await new ContractService(env.db).cancelRenewal(
      outsider.value.id,
      leagueId,
      "contract-guard-noteam",
    );

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
    const rivalTeamId = "team-guard-rival-1";
    await insertTeam(env.db, {
      id: rivalTeamId,
      name: "Rival Guard FC",
      playerId: rival.value.id,
      leagueId,
    });
    const today = Temporal.Now.plainDateISO();
    await env.db
      .prepare(
        `INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice, renewalElected)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
      )
      .bind(
        "contract-guard-rival",
        rivalTeamId,
        "Bitcoin",
        today.subtract({ days: 7 }).toString(),
        today.add({ days: 1 }).toString(),
        100,
      )
      .run();

    const result = await new ContractService(env.db).cancelRenewal(
      playerId,
      leagueId,
      "contract-guard-rival",
    );

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
    await insertElectedContract("contract-guard-race");
    const contractRepo = contractRepoOver(env.db, {
      cancelRenewal: async () => success(false),
    });

    const result = await new ContractService(
      env.db,
      contractRepo,
    ).cancelRenewal(playerId, leagueId, "contract-guard-race");

    expect(result).toEqual({
      ok: false,
      error: CONTRACT_ERRORS.RENEWAL_NOT_ELECTED,
    });
  });

  it("propagates a failure from the guarded withdrawal write", async () => {
    await insertElectedContract("contract-guard-writefail");
    const contractRepo = contractRepoOver(env.db, {
      cancelRenewal: async () => failure("Error cancelling contract renewal"),
    });

    const result = await new ContractService(
      env.db,
      contractRepo,
    ).cancelRenewal(playerId, leagueId, "contract-guard-writefail");

    expect(result).toEqual({
      ok: false,
      error: "Error cancelling contract renewal",
    });
  });

  it("propagates a failure to read the team", async () => {
    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      failingTeamRepo("Error retrieving team"),
    );

    const result = await service.cancelRenewal(playerId, leagueId, "any");

    expect(result).toEqual({ ok: false, error: "Error retrieving team" });
  });

  it("propagates a failure to read the league", async () => {
    const service = new ContractService(
      env.db,
      undefined,
      failingLeagueRepo("Error retrieving league"),
    );

    const result = await service.cancelRenewal(playerId, leagueId, "any");

    expect(result).toEqual({ ok: false, error: "Error retrieving league" });
  });

  it("propagates a failure to read the contract", async () => {
    const contractRepo = contractRepoOver(env.db, {
      getById: async () => failure("Error fetching contract"),
    });

    const result = await new ContractService(
      env.db,
      contractRepo,
    ).cancelRenewal(playerId, leagueId, "any");

    expect(result).toEqual({ ok: false, error: "Error fetching contract" });
  });

  /**
   * A re-run of the sweep over a contract a previous run already resolved must
   * be silent: the guarded write changes no rows, and notifying again would
   * tell the player twice that the same contract was settled or renewed.
   */
  it("does not notify when the settlement write finds the contract already settled", async () => {
    const messages: string[] = [];
    const contractRepo = contractRepoOver(env.db, {
      settleExpiry: async () => success(false),
    });
    const service = new ContractService(
      env.db,
      contractRepo,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(120000),
      recordingNotificationRepo(messages),
    );

    await service.settleDueContract(dueContract());

    expect(messages).toEqual([]);
  });

  it("does not notify when the renewal write finds the contract already renewed", async () => {
    const messages: string[] = [];
    const contractRepo = contractRepoOver(env.db, {
      renew: async () => success(false),
    });
    const service = new ContractService(
      env.db,
      contractRepo,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
      recordingNotificationRepo(messages),
    );

    await service.settleDueContract(dueContract({ renewalElected: true }));

    expect(messages).toEqual([]);
  });

  it("throws when the expiry settlement write fails, so the sweep step retries", async () => {
    const contractRepo = contractRepoOver(env.db, {
      settleExpiry: async () => failure("Error settling contract at expiry"),
    });
    const service = new ContractService(
      env.db,
      contractRepo,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(120000),
    );

    await expect(service.settleDueContract(dueContract())).rejects.toThrow(
      "Error settling contract at expiry",
    );
  });

  it("throws when the renewal write fails, so the sweep step retries", async () => {
    const contractRepo = contractRepoOver(env.db, {
      renew: async () => failure("Error renewing contract"),
    });
    const service = new ContractService(
      env.db,
      contractRepo,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(9000),
    );

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
    await env.db
      .prepare(
        `INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "contract-guard-nonotify",
        teamId,
        "Bitcoin",
        today.subtract({ days: 7 }).toString(),
        today.toString(),
        100,
      )
      .run();

    const notificationRepo = {
      create: async () => failure("Error creating notification"),
    } as unknown as NotificationRepository;
    const service = new ContractService(
      env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(120000),
      notificationRepo,
    );

    await expect(
      service.settleDueContract(dueContract({ id: "contract-guard-nonotify" })),
    ).resolves.toBeUndefined();

    const row = await env.db
      .prepare("SELECT settled, salePayout FROM contracts WHERE id = ?")
      .bind("contract-guard-nonotify")
      .first<{ settled: number; salePayout: number }>();
    expect(row?.settled).toBe(1);
    expect(row?.salePayout).toBe(priceFor(120000, 7));
  });
});
