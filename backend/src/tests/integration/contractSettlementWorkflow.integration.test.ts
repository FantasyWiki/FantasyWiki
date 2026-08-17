import { env } from "cloudflare:workers";
import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import { ContractService, RENEWAL_PREMIUM_RATE } from "../../services/contract";
import { PlayerService } from "../../services/player";
import { TeamService } from "../../services/team";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import { ContractSettlementWorkflow } from "../../workflows/contractSettlement";
import { ContractRepository } from "../../repositories/contractRepository";
import { failure, unwrap } from "../../repositories/result";
import {
  computeContractPrice,
  normalizedViews,
} from "../../../../model/pricing";
import { REFERENCE_SCALE } from "../../../../model/languageScale";
import { STARTING_CREDITS } from "../../../../model/team";
import { repositoriesFor } from "../../composition";
import { repositories } from "../support/target";
import { wikimediaWithAvg } from "../support/wikimedia";
import { withOverrides } from "../support/withOverrides";
import type { Contract } from "../../../../model";

const TIER_DAYS = 7;

/**
 * The real Workflow, with only its service factory overridden so settlement
 * prices come from a stub instead of the live Wikimedia API. `run` — the code
 * under test — is inherited untouched.
 */
class StubbedSettlementWorkflow extends ContractSettlementWorkflow {
  private readonly views: number | undefined;
  private readonly contractOverrides: Partial<ContractRepository> = {};

  constructor() {
    // WorkflowEntrypoint's constructor rejects any ExecutionContext the test
    // pool can synthesise, and `run` only ever reads `this.env` — so the
    // instance is built by `settlementWorkflowOver` below, not by `new`.
    super(undefined as never, undefined as never);
    this.views = undefined;
  }

  protected override createService(): ContractService {
    const built = repositoriesFor(this.env);
    return new ContractService({
      ...built,
      contracts: withOverrides(built.contracts, this.contractOverrides),
      wikimedia: wikimediaWithAvg(this.views),
    });
  }
}

/**
 * Builds the workflow without running `WorkflowEntrypoint`'s constructor (which
 * would reject the pool's ExecutionContext), binding the fields `run` reads.
 */
function settlementWorkflowOver(
  views: number | undefined,
  contractOverrides: Partial<ContractRepository> = {},
): ContractSettlementWorkflow {
  const workflow = Object.create(
    StubbedSettlementWorkflow.prototype,
  ) as StubbedSettlementWorkflow;
  Object.defineProperty(workflow, "env", { value: env });
  Object.defineProperty(workflow, "views", { value: views });
  Object.defineProperty(workflow, "contractOverrides", {
    value: contractOverrides,
  });
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
  log: StepLog,
  views: number | undefined,
  contractOverrides: Partial<ContractRepository> = {},
): Promise<void> {
  return settlementWorkflowOver(views, contractOverrides).run(
    { payload: { today: Temporal.Now.plainDateISO().toString() } } as never,
    recordingStep(log) as never,
  );
}

function priceFor(averageViews30d: number, tierDays: number): number {
  return computeContractPrice(
    normalizedViews(averageViews30d, REFERENCE_SCALE),
    tierDays,
  );
}

describe("ContractSettlementWorkflow Integration Tests", () => {
  let playerId: string;
  let teamId: string;

  /** An unsettled contract whose term ends today, so the sweep picks it up. */
  async function dueContract(opts: {
    articleId: string;
    purchasePrice: number;
    renewalElected?: boolean;
  }): Promise<Contract> {
    const expireDate = Temporal.Now.plainDateISO();
    const contract = unwrap(
      await repositories().contracts.create({
        teamId,
        articleId: opts.articleId,
        purchaseDate: expireDate.subtract({ days: TIER_DAYS }),
        expireDate,
        purchasePrice: opts.purchasePrice,
      }),
      `contract on ${opts.articleId}`,
    );

    if (opts.renewalElected) {
      unwrap(
        await repositories().contracts.electRenewal(contract.id, teamId),
        "renewal election",
      );
    }
    return contract;
  }

  async function readContract(id: string): Promise<Contract> {
    const contract = unwrap(
      await repositories().contracts.getById(id),
      "contract read-back",
    );
    if (contract === null) throw new Error(`Contract ${id} disappeared`);
    return contract;
  }

  /**
   * The payout is not on the domain Contract — it is a ledger column the derived
   * balance sums (ADR 0007) — so what a settlement paid out is read here.
   */
  async function credits(): Promise<number> {
    const team = unwrap(
      await repositories().teams.getByPlayerAndLeague(
        playerId,
        GLOBAL_LEAGUE_ID,
      ),
      "team",
    );
    if (team === null) throw new Error("team disappeared");
    return team.credits;
  }

  beforeEach(async () => {
    playerId = unwrap(
      await new PlayerService(repositories()).createPlayer(
        "workflowtester",
        "wf@example.com",
        "account-workflow-1",
      ),
      "player",
    ).id;
    // The Global League's domain is "en", which fixes the settlement price.
    teamId = unwrap(
      await new TeamService(repositories()).createTeam(
        playerId,
        GLOBAL_LEAGUE_ID,
        "Workflow FC",
      ),
      "team",
    ).id;
  });

  it("settles every due contract in its own named, retryable step", async () => {
    const first = await dueContract({
      articleId: "Bitcoin",
      purchasePrice: 50,
    });
    const second = await dueContract({
      articleId: "Ethereum",
      purchasePrice: 60,
    });

    const log: StepLog = [];
    await runSweep(log, 120000);

    // One fetch, then one step per due contract: a contract that fails
    // transiently retries on its own without re-settling the others.
    expect(log).toEqual([
      "fetch-due",
      `settle-${first.id}`,
      `settle-${second.id}`,
    ]);

    expect((await readContract(first.id)).settled).toBe(true);
    expect((await readContract(second.id)).settled).toBe(true);

    // Both paid out the live settlement price, which the balance is what shows.
    const settlementPrice = priceFor(120000, TIER_DAYS);
    expect(await credits()).toBe(
      STARTING_CREDITS - 50 - 60 + 2 * settlementPrice,
    );
  });

  it("carries contract dates across the step boundary, where only JSON survives", async () => {
    // A renewal is the strongest probe of the round-trip: the new window is
    // computed *from* the deserialized dates, so a PlainDate that failed to
    // survive JSON would roll the window to a wrong date rather than silently
    // passing.
    const elected = await dueContract({
      articleId: "Ethereum",
      purchasePrice: 100,
      renewalElected: true,
    });
    const before = await readContract(elected.id);

    const views = 9000;
    const log: StepLog = [];
    await runSweep(log, views);

    expect(log).toEqual(["fetch-due", `settle-${elected.id}`]);

    const currentPrice = priceFor(views, TIER_DAYS);
    // renewalCount is 0 on the row the sweep read, so this is the first
    // renewal — and the first renewal already carries the full +10%.
    const premium = Math.round(currentPrice * RENEWAL_PREMIUM_RATE * 1);
    const after = await readContract(elected.id);

    // Rolled forward rather than settled: purchaseDate <- old expireDate, +1 tier.
    expect(after.settled).toBe(false);
    expect(after.renewalCount).toBe(1);
    expect(after.purchasePrice).toBe(currentPrice + premium);
    expect(after.purchaseDate.toString()).toBe(before.expireDate.toString());
    expect(after.expireDate.toString()).toBe(
      before.expireDate.add({ days: TIER_DAYS }).toString(),
    );
  });

  it("leaves a contract unsettled when its views fetch fails, so a later sweep retries it", async () => {
    const contract = await dueContract({
      articleId: "Bitcoin",
      purchasePrice: 50,
    });

    const log: StepLog = [];
    // The step throws, which is what drives Cloudflare's per-step retry; never
    // settle at 0, which would hand out a forfeited settlement.
    await expect(runSweep(log, undefined)).rejects.toThrow(
      /Couldn't fetch views/,
    );

    expect((await readContract(contract.id)).settled).toBe(false);
    // Nothing paid out: the purchase is still the only entry on the ledger.
    expect(await credits()).toBe(STARTING_CREDITS - 50);
  });

  it("fails the fetch-due step when the due contracts cannot be read", async () => {
    const log: StepLog = [];
    await expect(
      runSweep(log, 120000, {
        getDueForSettlement: async () =>
          failure("Error fetching due contracts: store unavailable"),
      }),
    ).rejects.toThrow(/Error fetching due contracts/);
    // Failed before any contract was resolved: no settle step ran.
    expect(log).toEqual(["fetch-due"]);
  });

  /**
   * The seam the tests above lean on is only safe if the un-overridden factory
   * still wires the real thing: production must get a ContractService bound to
   * the Workflow's own bindings, never a leftover double.
   */
  it("builds a service over its own bindings by default", () => {
    const workflow = Object.create(
      ContractSettlementWorkflow.prototype,
    ) as ContractSettlementWorkflow & {
      createService(): ContractService;
    };
    Object.defineProperty(workflow, "env", { value: env });

    expect(workflow.createService()).toBeInstanceOf(ContractService);
  });

  it("settles nothing when no contract has reached the end of its term", async () => {
    const future = unwrap(
      await repositories().contracts.create({
        teamId,
        articleId: "Bitcoin",
        purchaseDate: Temporal.Now.plainDateISO(),
        expireDate: Temporal.Now.plainDateISO().add({ days: 5 }),
        purchasePrice: 50,
      }),
      "future contract",
    );

    const log: StepLog = [];
    await runSweep(log, 120000);

    expect(log).toEqual(["fetch-due"]);
    expect((await readContract(future.id)).settled).toBe(false);
  });
});
