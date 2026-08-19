import { Lineup } from "../../../../model";
import { LineupRepository } from "../lineupRepository";
import { Result, success, failure } from "../result";
import { errorMessage } from "./connection";
import type { MongoStore } from "./store";

export class LineupRepositoryMongo implements LineupRepository {
  constructor(private readonly store: MongoStore) {}

  async getByTeamId(teamId: string): Promise<Result<Lineup | null>> {
    try {
      const { lineups } = await this.store.collections();
      const doc = await lineups.findOne({ _id: teamId });
      if (!doc) return success(null);
      return success({
        teamId: doc._id,
        schema: doc.schema,
        formation: doc.formation,
        updatedAt: doc.updatedAt,
      });
    } catch (error) {
      return failure(`Error fetching lineup: ${errorMessage(error)}`);
    }
  }

  async upsert(data: {
    teamId: string;
    schema: string;
    formation: string;
    updatedAt: string;
  }): Promise<Result<void>> {
    try {
      const { lineups } = await this.store.collections();
      // Replaced whole rather than merged: a team has one lineup, and the
      // caller always sends all of it.
      await lineups.replaceOne(
        { _id: data.teamId },
        {
          schema: data.schema,
          formation: data.formation,
          updatedAt: data.updatedAt,
        },
        { upsert: true },
      );
      return success(undefined);
    } catch (error) {
      return failure(`Error upserting lineup: ${errorMessage(error)}`);
    }
  }
}
