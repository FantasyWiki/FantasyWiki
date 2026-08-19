import { League, Player } from "../../../../model";
import { PLAYER_ERRORS, PlayerRepository } from "../playerRepository";
import { Result, success, failure } from "../result";
import { errorMessage, isDuplicateKey } from "./connection";
import { toLeague } from "./leagueRepositoryMongo";
import { COLLECTIONS, type LeagueDoc } from "./schema";
import type { MongoStore } from "./store";

export class PlayerRepositoryMongo implements PlayerRepository {
  constructor(private readonly store: MongoStore) {}

  async save(player: {
    username: string;
    accountId: string;
    email: string;
  }): Promise<Result<Player>> {
    try {
      const { googleAccounts, players } = await this.store.collections();
      const id = crypto.randomUUID();

      // The account first, since the player references it, and insert-if-absent
      // because a retry with another username arrives with the same account.
      await googleAccounts.updateOne(
        { _id: player.accountId },
        {
          $setOnInsert: {
            googleId: player.accountId,
            email: player.email,
          },
        },
        { upsert: true },
      );

      await players.insertOne({
        _id: id,
        username: player.username,
        accountId: player.accountId,
      });

      return success({ id, username: player.username });
    } catch (error) {
      // The one failure a caller can recover from — `LoginService` retries with
      // another username — so it is named rather than left as driver text.
      if (isDuplicateKey(error, "username")) {
        return failure(PLAYER_ERRORS.USERNAME_TAKEN);
      }
      return failure(`Error saving player: ${errorMessage(error)}`);
    }
  }

  async getById(id: string): Promise<Result<Player>> {
    try {
      const { players } = await this.store.collections();
      const doc = await players.findOne({ _id: id });
      if (!doc) return failure(PLAYER_ERRORS.NOT_FOUND);
      return success({ id: doc._id, username: doc.username });
    } catch (error) {
      return failure(`Error retrieving player: ${errorMessage(error)}`);
    }
  }

  async getLeaguesByPlayerId(id: string): Promise<Result<League[]>> {
    try {
      const { teams } = await this.store.collections();
      // The leagues they play, not the leagues they have ever played: a league
      // a player left is no longer theirs to pick or act in, even though their
      // team still stands in it (docs/domain/league-lifecycle.md).
      const docs = await teams
        .aggregate<LeagueDoc>([
          { $match: { playerId: id, leftAt: null } },
          {
            $lookup: {
              from: COLLECTIONS.leagues,
              localField: "leagueId",
              foreignField: "_id",
              as: "league",
            },
          },
          { $unwind: "$league" },
          { $replaceRoot: { newRoot: "$league" } },
        ])
        .toArray();

      return success(docs.map(toLeague));
    } catch (error) {
      return failure(`Error retrieving leagues: ${errorMessage(error)}`);
    }
  }

  async getPlayerByAccountId(accountId: string): Promise<Result<Player>> {
    try {
      const { players } = await this.store.collections();
      const doc = await players.findOne({ accountId });
      // Not an error the caller has to recover from by itself: a first-time
      // login is this, and `LoginService` turns it into an account.
      if (!doc) return failure(PLAYER_ERRORS.ACCOUNT_NOT_FOUND);
      return success({ id: doc._id, username: doc.username });
    } catch (error) {
      return failure(`Error retrieving player: ${errorMessage(error)}`);
    }
  }
}
