import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { Temporal } from "@js-temporal/polyfill";
import { ContractService } from "../services/contract";
import { DueContract } from "../repositories/contractRepository";

export type ContractSettlementParams = {
  /** ISO date (YYYY-MM-DD) the sweep resolves contracts as of. */
  today: string;
};

type Env = {
  db: D1Database;
};

/**
 * A DueContract flattened to a JSON-serializable shape so it can cross the
 * boundary between the `fetch-due` step and each per-contract `settle-*` step
 * (Temporal.PlainDate isn't serializable). `teamCredits` is the derived
 * balance at the start of the sweep — a fine basis for the daily settlement
 * job, which is the single money-writer.
 */
type SerializedDueContract = {
  id: string;
  teamId: string;
  articleId: string;
  purchaseDate: string;
  expireDate: string;
  purchasePrice: number;
  settled: boolean;
  renewalCount: number;
  renewalElected: boolean;
  domain: string;
  teamCredits: number;
};

function serialize(contract: DueContract): SerializedDueContract {
  return {
    id: contract.id,
    teamId: contract.teamId,
    articleId: contract.articleId,
    purchaseDate: contract.purchaseDate.toString(),
    expireDate: contract.expireDate.toString(),
    purchasePrice: contract.purchasePrice,
    settled: contract.settled,
    renewalCount: contract.renewalCount,
    renewalElected: contract.renewalElected,
    domain: contract.domain,
    teamCredits: contract.teamCredits,
  };
}

function deserialize(contract: SerializedDueContract): DueContract {
  return {
    id: contract.id,
    teamId: contract.teamId,
    articleId: contract.articleId,
    purchaseDate: Temporal.PlainDate.from(contract.purchaseDate),
    expireDate: Temporal.PlainDate.from(contract.expireDate),
    purchasePrice: contract.purchasePrice,
    settled: contract.settled,
    renewalCount: contract.renewalCount,
    renewalElected: contract.renewalElected,
    domain: contract.domain,
    teamCredits: contract.teamCredits,
  };
}

/**
 * Daily settlement sweep (ADR 0003), run as a durable Workflow so each
 * contract is resolved in its own retryable step: a flaky Wikimedia call or a
 * transient D1 error retries that one contract with backoff without re-doing
 * the others, and the guarded writes in ContractService make every step
 * idempotent. The Workflow stays thin — all business logic lives in
 * `ContractService.settleDueContract`, which the integration tests exercise
 * directly.
 */
export class ContractSettlementWorkflow extends WorkflowEntrypoint<
  Env,
  ContractSettlementParams
> {
  /**
   * The Workflow is constructed by the runtime, so its dependencies cannot come
   * in through the constructor the way every service's do. This factory is the
   * seam instead: tests override it to settle against a stubbed Wikimedia
   * client rather than the live API.
   */
  protected createService(): ContractService {
    return new ContractService(this.env.db);
  }

  async run(
    event: WorkflowEvent<ContractSettlementParams>,
    step: WorkflowStep,
  ): Promise<void> {
    const today = Temporal.PlainDate.from(event.payload.today);
    const service = this.createService();

    const due = await step.do("fetch-due", async () => {
      const result = await service.getDueForSettlement(today);
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.value.map(serialize);
    });

    for (const contract of due) {
      await step.do(`settle-${contract.id}`, async () => {
        await service.settleDueContract(deserialize(contract));
      });
    }
  }
}
