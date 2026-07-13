import { env } from "cloudflare:workers";
import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import { ContractService } from "../../services/contract";
import { NotificationService } from "../../services/notification";
import { PlayerService } from "../../services/player";
import { TeamRepositoryD1 } from "../../repositories/d1/teamRepositoryD1";
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
});
