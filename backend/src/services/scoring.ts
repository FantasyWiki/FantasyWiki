import { Temporal } from "@js-temporal/polyfill";
import { CHEMISTRY_LINKS } from "../../../model/enums";
import { ScoringRepositoryD1 } from "../repositories/d1/scoringRepositoryD1";
import { PerformanceRepositoryD1 } from "../repositories/d1/performanceRepositoryD1";
import type { ScoringRepository } from "../repositories/scoringRepository";
import type {
  PerformanceRepository,
  PerformanceUpsertRow,
} from "../repositories/performanceRepository";
import { Result, success, failure } from "../repositories/result";
import type {
  ScoringInputDTO,
  PerformanceResultDTO,
} from "../../../dto/scoring";

/**
 * Orchestrates the internal scoring loop (docs/plan-scoring-engine.md §6):
 * hands the engine the day's inputs and ingests the results it computes. The
 * backend stays the single writer to D1 — the engine never touches the DB
 * directly (ADR 0004 "single money-writer" boundary).
 */
export class ScoringService {
  constructor(
    private scoringRepository: ScoringRepository,
    private performanceRepository: PerformanceRepository,
  ) {}

  /** Build a D1-backed instance — the production/route construction path. */
  static fromDb(db: D1Database): ScoringService {
    return new ScoringService(
      new ScoringRepositoryD1(db),
      new PerformanceRepositoryD1(db),
    );
  }

  /**
   * Every scorable team's inputs for `date`: schema + the position->articleId
   * placements backed by an active contract. Slots whose contract is settled or
   * expired on `date` are dropped (the article has left the team).
   */
  async getScoringInputs(
    date: Temporal.PlainDate,
  ): Promise<Result<ScoringInputDTO[]>> {
    const [lineupsResult, contractsResult] = await Promise.all([
      this.scoringRepository.getTeamLineups(),
      this.scoringRepository.getActiveContracts(date),
    ]);
    if (!lineupsResult.ok) return lineupsResult;
    if (!contractsResult.ok) return contractsResult;

    const articleByTeamContract = new Map<string, Map<string, string>>();
    for (const contract of contractsResult.value) {
      let byContract = articleByTeamContract.get(contract.teamId);
      if (!byContract) {
        byContract = new Map();
        articleByTeamContract.set(contract.teamId, byContract);
      }
      byContract.set(contract.id, contract.articleId);
    }

    const inputs: ScoringInputDTO[] = lineupsResult.value.map((row) => {
      const contracts =
        articleByTeamContract.get(row.teamId) ?? new Map<string, string>();

      let stored: Record<string, string>;
      try {
        stored = JSON.parse(row.formation) as Record<string, string>;
      } catch {
        stored = {};
      }

      // Resolve position -> articleId for slots backed by an active contract.
      const placements: Record<string, string> = {};
      for (const [position, contractId] of Object.entries(stored)) {
        const articleId = contracts.get(contractId);
        if (articleId) {
          placements[position] = articleId;
        }
      }

      // Resolve the schema's Chemistry Links to concrete article pairs here, so
      // the engine stays unaware of schemas/positions — a new formation only
      // touches CHEMISTRY_LINKS (model/enums.ts), never the engine. Pairs with
      // an empty endpoint are dropped (they contribute no synergy).
      const schemaLinks =
        (
          CHEMISTRY_LINKS as Record<
            string,
            ReadonlyArray<readonly [string, string]>
          >
        )[row.schema] ?? [];
      const chemistryLinks: Array<[string, string]> = [];
      for (const [positionA, positionB] of schemaLinks) {
        const articleA = placements[positionA];
        const articleB = placements[positionB];
        if (articleA && articleB) {
          chemistryLinks.push([articleA, articleB]);
        }
      }

      return {
        leagueId: row.leagueId,
        teamId: row.teamId,
        domain: row.domain,
        articles: Object.values(placements),
        chemistryLinks,
        formationSnapshot: JSON.stringify(placements),
      };
    });

    return success(inputs);
  }

  /**
   * Idempotent ingest of computed daily results. Validates shape only — points
   * must be a finite, non-negative number — then upserts on (teamId, date).
   */
  async ingestPerformances(
    date: Temporal.PlainDate,
    results: PerformanceResultDTO[],
  ): Promise<Result<{ written: number }>> {
    if (!Array.isArray(results)) {
      return failure("results must be an array");
    }

    const rows: PerformanceUpsertRow[] = [];
    for (const result of results) {
      if (typeof result.teamId !== "string" || result.teamId.length === 0) {
        return failure("each result requires a non-empty teamId");
      }
      if (
        typeof result.points !== "number" ||
        !Number.isFinite(result.points) ||
        result.points < 0
      ) {
        return failure(`invalid points for team ${result.teamId}`);
      }
      const formationSnapshot =
        typeof result.formationSnapshot === "string"
          ? result.formationSnapshot
          : "{}";
      rows.push({
        teamId: result.teamId,
        points: result.points,
        formationSnapshot,
      });
    }

    const upsertResult = await this.performanceRepository.upsertDaily(
      date,
      rows,
    );
    if (!upsertResult.ok) return upsertResult;
    return success({ written: rows.length });
  }
}
