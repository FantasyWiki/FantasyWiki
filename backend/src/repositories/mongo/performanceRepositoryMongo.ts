import { Temporal } from "@js-temporal/polyfill";
import { Performance } from "../../../../model";
import { Result, success, failure } from "../result";
import type {
  PerformanceRepository,
  PerformanceUpsertRow,
  TeamCumulative,
} from "../performanceRepository";
import { errorMessage } from "./connection";
import {
  COLLECTIONS,
  performanceId,
  teamCreditsStages,
  type PerformanceDoc,
} from "./schema";
import type { MongoStore } from "./store";

export class PerformanceRepositoryMongo implements PerformanceRepository {
  constructor(private readonly store: MongoStore) {}

  async upsertDaily(
    date: Temporal.PlainDate,
    rows: PerformanceUpsertRow[],
  ): Promise<Result<void>> {
    if (rows.length === 0) return success(undefined);
    try {
      const { performances } = await this.store.collections();
      const day = date.toString();
      // Keyed on (team, date), so re-running a day's sweep recomputes it rather
      // than appending a second row.
      await performances.bulkWrite(
        rows.map((row) => ({
          updateOne: {
            filter: { _id: performanceId(row.teamId, day) },
            update: {
              $set: {
                teamId: row.teamId,
                date: day,
                points: row.points,
                historical_formation: row.formationSnapshot,
              },
            },
            upsert: true,
          },
        })),
      );
      return success(undefined);
    } catch (error) {
      return failure(`Error upserting performances: ${errorMessage(error)}`);
    }
  }

  async getRecentByTeam(
    teamId: string,
    limit: number,
  ): Promise<Result<Performance[]>> {
    try {
      const { performances } = await this.store.collections();
      const docs = await performances
        .find({ teamId })
        .sort({ date: -1 })
        .limit(limit)
        .toArray();
      // The stored row, as the D1 read hands it over: `date` is text and the
      // snapshot keeps its column name. `PerformanceService` is what turns
      // either into a DTO.
      return success(
        docs.map(
          ({ teamId, date, points, historical_formation }) =>
            ({
              teamId,
              date,
              points,
              historical_formation,
            }) as unknown as Performance,
        ),
      );
    } catch (error) {
      return failure(
        `Error fetching recent performances: ${errorMessage(error)}`,
      );
    }
  }

  async getLeagueCumulatives(
    leagueId: string,
  ): Promise<Result<TeamCumulative[]>> {
    try {
      const { teams } = await this.store.collections();
      // Team-anchored, so a team that has never scored still appears — the
      // standings are the only place a league's roster is visible.
      const rows = await teams
        .aggregate<{
          teamId: string;
          teamName: string;
          teamCredits: number;
          playerId: string;
          playerName: string;
          days: Pick<PerformanceDoc, "date" | "points">[];
        }>([
          { $match: { leagueId } },
          ...teamCreditsStages("_id", "teamCredits"),
          {
            $lookup: {
              from: COLLECTIONS.players,
              localField: "playerId",
              foreignField: "_id",
              as: "player",
            },
          },
          { $unwind: "$player" },
          {
            $lookup: {
              from: COLLECTIONS.performances,
              localField: "_id",
              foreignField: "teamId",
              as: "days",
            },
          },
          {
            $project: {
              _id: 0,
              teamId: "$_id",
              teamName: "$name",
              teamCredits: 1,
              playerId: "$player._id",
              playerName: "$player.username",
              "days.date": 1,
              "days.points": 1,
            },
          },
        ])
        .toArray();

      return success(
        rows.map((row) => {
          const latestDay = row.days.reduce(
            (latest, day) => (day.date > latest ? day.date : latest),
            "",
          );
          const total = (days: typeof row.days) =>
            days.reduce((sum, day) => sum + day.points, 0);
          return {
            teamId: row.teamId,
            teamName: row.teamName,
            teamCredits: row.teamCredits,
            playerId: row.playerId,
            playerName: row.playerName,
            cumulativeLatest: total(row.days),
            // Yesterday's standing — what a rank delta is measured against, so
            // it stops short of the team's own most recent scored day.
            cumulativePrevious: total(
              row.days.filter((day) => day.date < latestDay),
            ),
          };
        }),
      );
    } catch (error) {
      return failure(
        `Error fetching league cumulatives: ${errorMessage(error)}`,
      );
    }
  }
}
