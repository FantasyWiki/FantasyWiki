import { LeaderboardEntryDTO } from "../../../dto/leaderboardDTO";
import { PerformanceRepositoryD1 } from "../repositories/d1/performanceRepositoryD1";
import type { PerformanceRepository } from "../repositories/performanceRepository";
import { Result, success } from "../repositories/result";

export class LeaderboardService {
  private repository: PerformanceRepository;

  constructor(repositoryOrDb: PerformanceRepository | D1Database) {
    if ("getLeagueCumulatives" in repositoryOrDb) {
      this.repository = repositoryOrDb;
      return;
    }
    this.repository = new PerformanceRepositoryD1(repositoryOrDb);
  }

  async getLeaderboard(
    leagueId: string,
  ): Promise<Result<LeaderboardEntryDTO[]>> {
    const cumulativesResult =
      await this.repository.getLeagueCumulatives(leagueId);
    if (!cumulativesResult.ok) {
      return cumulativesResult;
    }

    const rows = cumulativesResult.value;

    // Sort by current cumulative desc to assign current ranks.
    const byLatest = [...rows].sort(
      (a, b) => b.cumulativeLatest - a.cumulativeLatest,
    );

    // Sort by previous cumulative desc to assign yesterday's ranks.
    const byPrevious = [...rows].sort(
      (a, b) => b.cumulativePrevious - a.cumulativePrevious,
    );
    const previousRankByTeam = new Map(
      byPrevious.map((r, i) => [r.teamId, i + 1]),
    );

    const entries: LeaderboardEntryDTO[] = byLatest.map((r, i) => {
      const rank = i + 1;
      // null = no previous scoring history, rank movement is meaningless.
      const rankDelta =
        r.cumulativePrevious === 0
          ? null
          : previousRankByTeam.get(r.teamId)! - rank;

      return {
        team: {
          id: r.teamId,
          name: r.teamName,
          credits: r.teamCredits,
          player: { id: r.playerId, name: r.playerName },
        },
        cumulativePoints: r.cumulativeLatest,
        rank,
        rankDelta,
      };
    });

    return success(entries);
  }
}
