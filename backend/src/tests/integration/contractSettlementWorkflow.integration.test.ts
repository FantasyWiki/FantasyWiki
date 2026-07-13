import { env } from "cloudflare:workers";
import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import { ContractService, RENEWAL_PREMIUM_RATE } from "../../services/contract";
import { ContractSettlementWorkflow } from "../../workflows/contractSettlement";
import { WikimediaClient } from "../../../../external-apis/wikimedia/client";
import {
  computeContractPrice,
  normalizedViews,
  resolveLanguageScale,
} from "../../../../model/pricing";
import { insertTeam } from "../utils/d1TestUtils";

const TIER_DAYS = 7;

/**
 * WikimediaClient stub exposing only `pageviews.getArticleViews`, the sole
 * capability the settlement sweep exercises; everything else throws so an
 * accidental dependency fails loudly. Mirrors the helper in
 * contract.integration.test.ts.
 */
function wikimediaWithAvg(
  averageViews30d: number | undefined,
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

/**
 * The real Workflow, with only its service factory overridden so settlement
 * prices come from a stub instead of the live Wikimedia API. `run` — the code
 * under test — is inherited untouched.
 */
class StubbedSettlementWorkflow extends ContractSettlementWorkflow {
  constructor(private readonly views: number | undefined) {
    // WorkflowEntrypoint's constructor rejects any ExecutionContext the test
    // pool can synthesise, and `run` only ever reads `this.env` — so the
    // instance is built by `settlementWorkflowOver` below, not by `new`.
    super(undefined as never, undefined as never);
  }

  protected override createService(): ContractService {
    return new ContractService(
      this.env.db,
      undefined,
      undefined,
      undefined,
      undefined,
      wikimediaWithAvg(this.views),
    );
  }
}

/**
 * Builds the workflow without running `WorkflowEntrypoint`'s constructor (which
 * would reject the pool's ExecutionContext), binding the two fields `run`
 * actually reads.
 */
function settlementWorkflowOver(
  db: D1Database,
  views: number | undefined,
): ContractSettlementWorkflow {
  const workflow = Object.create(
    StubbedSettlementWorkflow.prototype,
  ) as StubbedSettlementWorkflow;
  Object.defineProperty(workflow, "env", { value: { db } });
  Object.defineProperty(workflow, "views", { value: views });
  return workflow;
}

/** The steps a run performed, in order. */
type StepLog = string[];

/**
 * Stand-in for Cloudflare's `WorkflowStep` mirroring the two behaviours the
 * production code leans on: each `do` is a named, independently retryable unit,
 * and its return value is **persisted**, i.e. it survives only as JSON.
 * Round-tripping through JSON is what makes this a real test of the
 * serialize/deserialize pair — a `Temporal.PlainDate` returned raw would reach
 * the settle step as `{}`.
 */
function recordingStep(log: StepLog) {
  return {
    do: async (name: string, callback: () => Promise<unknown>) => {
      log.push(name);
      const value = await callback();
      return JSON.parse(JSON.stringify(value ?? null));
    },
  };
}

/** `views` is explicit at every call: `undefined` means the fetch found none. */
function runSweep(
  db: D1Database,
  log: StepLog,
  views: number | undefined,
): Promise<void> {
  return settlementWorkflowOver(db, views).run(
    { payload: { today: Temporal.Now.plainDateISO().toString() } } as never,
    recordingStep(log) as never,
  );
}

function priceFor(averageViews30d: number, tierDays: number): number {
  return computeContractPrice(
    normalizedViews(averageViews30d, resolveLanguageScale("en")),
    tierDays,
  );
}

describe("ContractSettlementWorkflow Integration Tests", () => {
  let playerId: string;
  const leagueId = "league-workflow-1";
  const teamId = "team-workflow-1";

  /** An unsettled contract whose term ends today, so the sweep picks it up. */
  async function insertDueContract(opts: {
    id: string;
    articleId: string;
    purchasePrice: number;
    renewalElected?: boolean;
  }): Promise<void> {
    const expireDate = Temporal.Now.plainDateISO();
    const purchaseDate = expireDate.subtract({ days: TIER_DAYS });
    await env.db
      .prepare(
        `INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice, renewalElected, renewalCount)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .bind(
        opts.id,
        teamId,
        opts.articleId,
        purchaseDate.toString(),
        expireDate.toString(),
        opts.purchasePrice,
        opts.renewalElected ? 1 : 0,
      )
      .run();
  }

  async function readContractRow(id: string) {
    return env.db
      .prepare("SELECT * FROM contracts WHERE id = ?")
      .bind(id)
      .first<{
        purchaseDate: string;
        expireDate: string;
        purchasePrice: number;
        settled: number;
        salePayout: number | null;
        renewalCount: number;
        renewalElected: number;
      }>();
  }

  beforeEach(async () => {
    playerId = crypto.randomUUID();
    await env.db
      .prepare(
        "INSERT INTO google_accounts (id, googleId, email) VALUES (?, ?, ?)",
      )
      .bind("account-workflow-1", "account-workflow-1", "wf@example.com")
      .run();
    await env.db
      .prepare("INSERT INTO players (id, username, accountId) VALUES (?, ?, ?)")
      .bind(playerId, "workflowtester", "account-workflow-1")
      .run();

    await env.db
      .prepare(
        `INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        leagueId,
        "Workflow League",
        playerId,
        new Date().toISOString(),
        new Date().toISOString(),
        "en",
        "🏆",
      )
      .run();

    await insertTeam(env.db, {
      id: teamId,
      name: "Workflow FC",
      playerId,
      leagueId,
    });
  });

  it("settles every due contract in its own named, retryable step", async () => {
    await insertDueContract({
      id: "wf-contract-a",
      articleId: "Bitcoin",
      purchasePrice: 50,
    });
    await insertDueContract({
      id: "wf-contract-b",
      articleId: "Ethereum",
      purchasePrice: 60,
    });

    const log: StepLog = [];
    await runSweep(env.db, log, 120000);

    // One fetch, then one step per due contract: a contract that fails
    // transiently retries on its own without re-settling the others.
    expect(log).toEqual([
      "fetch-due",
      "settle-wf-contract-a",
      "settle-wf-contract-b",
    ]);

    const settlementPrice = priceFor(120000, TIER_DAYS);
    for (const id of ["wf-contract-a", "wf-contract-b"]) {
      const row = await readContractRow(id);
      expect(row?.settled).toBe(1);
      expect(row?.salePayout).toBe(settlementPrice);
    }
  });

  it("carries contract dates across the step boundary, where only JSON survives", async () => {
    // A renewal is the strongest probe of the round-trip: the new window is
    // computed *from* the deserialized dates, so a PlainDate that failed to
    // survive JSON would roll the window to a wrong date rather than silently
    // passing.
    await insertDueContract({
      id: "wf-contract-renew",
      articleId: "Ethereum",
      purchasePrice: 100,
      renewalElected: true,
    });
    const before = await readContractRow("wf-contract-renew");

    const views = 9000;
    const log: StepLog = [];
    await runSweep(env.db, log, views);

    expect(log).toEqual(["fetch-due", "settle-wf-contract-renew"]);

    const currentPrice = priceFor(views, TIER_DAYS);
    // renewalCount is 0 on the row the sweep read, so no premium is due yet.
    const premium = Math.round(currentPrice * RENEWAL_PREMIUM_RATE * 0);
    const row = await readContractRow("wf-contract-renew");

    // Rolled forward rather than settled: purchaseDate <- old expireDate, +1 tier.
    expect(row?.settled).toBe(0);
    expect(row?.renewalCount).toBe(1);
    expect(row?.purchasePrice).toBe(currentPrice + premium);
    expect(row?.purchaseDate).toBe(before?.expireDate);
    expect(row?.expireDate).toBe(
      Temporal.PlainDate.from(before!.expireDate)
        .add({ days: TIER_DAYS })
        .toString(),
    );
  });

  it("leaves a contract unsettled when its views fetch fails, so a later sweep retries it", async () => {
    await insertDueContract({
      id: "wf-contract-noviews",
      articleId: "Bitcoin",
      purchasePrice: 50,
    });

    const log: StepLog = [];
    // The step throws, which is what drives Cloudflare's per-step retry; never
    // settle at 0, which would hand out a forfeited settlement.
    await expect(runSweep(env.db, log, undefined)).rejects.toThrow(
      /Couldn't fetch views/,
    );

    const row = await readContractRow("wf-contract-noviews");
    expect(row?.settled).toBe(0);
    expect(row?.salePayout).toBeNull();
  });

  it("fails the fetch-due step when the due contracts cannot be read", async () => {
    const throwingDb = {
      prepare: () => {
        throw new Error("D1 unavailable");
      },
    } as unknown as D1Database;

    const log: StepLog = [];
    await expect(runSweep(throwingDb, log, 120000)).rejects.toThrow(
      /Error fetching due contracts/,
    );
    // Failed before any contract was resolved: no settle step ran.
    expect(log).toEqual(["fetch-due"]);
  });

  /**
   * The seam the tests above lean on is only safe if the un-overridden factory
   * still wires the real thing: production must get a ContractService bound to
   * the Workflow's own D1 binding, never a leftover double.
   */
  it("builds a service over its own database binding by default", () => {
    const workflow = Object.create(
      ContractSettlementWorkflow.prototype,
    ) as ContractSettlementWorkflow & {
      createService(): ContractService;
    };
    Object.defineProperty(workflow, "env", { value: { db: env.db } });

    expect(workflow.createService()).toBeInstanceOf(ContractService);
  });

  it("settles nothing when no contract has reached the end of its term", async () => {
    await env.db
      .prepare(
        `INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "wf-contract-future",
        teamId,
        "Bitcoin",
        Temporal.Now.plainDateISO().toString(),
        Temporal.Now.plainDateISO().add({ days: 5 }).toString(),
        50,
      )
      .run();

    const log: StepLog = [];
    await runSweep(env.db, log, 120000);

    expect(log).toEqual(["fetch-due"]);
    const row = await readContractRow("wf-contract-future");
    expect(row?.settled).toBe(0);
  });
});
