import { Temporal } from "@js-temporal/polyfill";
import { Result, success, failure } from "../result";
import type {
  ScoringRepository,
  TeamLineupRow,
  ActiveContractRow,
} from "../scoringRepository";
import { errorMessage } from "./connection";
import { COLLECTIONS } from "./schema";
import type { MongoStore } from "./store";

export class ScoringRepositoryMongo implements ScoringRepository {
  constructor(private readonly store: MongoStore) {}

  async getTeamLineups(): Promise<Result<TeamLineupRow[]>> {
    try {
      const { teams } = await this.store.collections();
      // Only teams that have set a lineup are scorable; the `$unwind` after the
      // lookup drops the ones with no formation yet, as the INNER JOIN does.
      const rows = await teams
        .aggregate<TeamLineupRow>([
          {
            $lookup: {
              from: COLLECTIONS.leagues,
              localField: "leagueId",
              foreignField: "_id",
              as: "league",
            },
          },
          { $unwind: "$league" },
          {
            $lookup: {
              from: COLLECTIONS.lineups,
              localField: "_id",
              foreignField: "_id",
              as: "lineup",
            },
          },
          { $unwind: "$lineup" },
          {
            $project: {
              _id: 0,
              teamId: "$_id",
              leagueId: 1,
              domain: "$league.domain",
              // The league's frozen factor — what its scores are normalized by
              // (ADR 0002).
              languageScale: "$league.languageScale",
              schema: "$lineup.schema",
              formation: "$lineup.formation",
            },
          },
        ])
        .toArray();
      return success(rows);
    } catch (error) {
      return failure(`Error fetching team lineups: ${errorMessage(error)}`);
    }
  }

  async getActiveContracts(
    date: Temporal.PlainDate,
  ): Promise<Result<ActiveContractRow[]>> {
    try {
      const { contracts } = await this.store.collections();
      // "Active on day D": owned (not settled), and D falls within the held
      // term. The dates are 'YYYY-MM-DD', so a string comparison is a
      // chronological one.
      const day = date.toString();
      const rows = await contracts
        .aggregate<ActiveContractRow>([
          {
            $match: {
              settled: false,
              purchaseDate: { $lte: day },
              expireDate: { $gt: day },
            },
          },
          { $project: { _id: 0, id: "$_id", teamId: 1, articleId: 1 } },
        ])
        .toArray();
      return success(rows);
    } catch (error) {
      return failure(`Error fetching active contracts: ${errorMessage(error)}`);
    }
  }
}
