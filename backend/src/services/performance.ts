import { Temporal } from "@js-temporal/polyfill";
import type { PerformanceRepository } from "../repositories/performanceRepository";
import { PerformanceRepositoryD1 } from "../repositories/d1/performanceRepositoryD1";
import { Result, success } from "../repositories/result";
import { PerformanceDTO } from "../../../dto/performanceDTO";

export class PerformanceService {
  constructor(private repository: PerformanceRepository) {}

  /** Build a D1-backed instance — the production/route construction path. */
  static fromDb(db: D1Database): PerformanceService {
    return new PerformanceService(new PerformanceRepositoryD1(db));
  }

  async getRecentForTeam(
    teamId: string,
    limit: number,
  ): Promise<Result<PerformanceDTO[]>> {
    const result = await this.repository.getRecentByTeam(teamId, limit);
    if (!result.ok) {
      return result;
    }
    const dtos: PerformanceDTO[] = result.value.map((p) => ({
      teamId: p.teamId,
      // formation stored as JSON string in D1; full resolution is deferred
      formation: p.formation as unknown as PerformanceDTO["formation"],
      date: Temporal.PlainDate.from(p.date as unknown as string),
      points: p.points,
    }));
    return success(dtos);
  }
}
