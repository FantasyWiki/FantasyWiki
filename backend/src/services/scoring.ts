import { Temporal } from "@js-temporal/polyfill";
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

      const placements: Record<string, string> = {};
      for (const [position, contractId] of Object.entries(stored)) {
        const articleId = contracts.get(contractId);
        if (articleId) {
          placements[position] = articleId;
        }
      }

      return {
        leagueId: row.leagueId,
        teamId: row.teamId,
        domain: row.domain,
        schema: row.schema,
        placements,
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
      const formation =
        result.formation && typeof result.formation === "object"
          ? result.formation
          : {};
      rows.push({ teamId: result.teamId, points: result.points, formation });
    }

    const upsertResult = await this.performanceRepository.upsertDaily(
      date,
      rows,
    );
    if (!upsertResult.ok) return upsertResult;
    return success({ written: rows.length });
  }
}
