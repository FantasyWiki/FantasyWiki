import type { Filter } from "mongodb";
import {
  NewNotification,
  NotificationRepository,
  NotificationRow,
  NOTIFICATION_ERRORS,
} from "../notificationRepository";
import { Result, success, failure } from "../result";
import { errorMessage } from "./connection";
import { COLLECTIONS, teamCreditsStages, type NotificationDoc } from "./schema";
import type { MongoStore } from "./store";

/**
 * A notification with the contract, team and player it concerns — so a feed can
 * be built without a lookup per row.
 *
 * The joins are the shape of the D1 query's, and the `$unwind`s are its INNER
 * JOINs: a notification whose contract or team has gone is not in the feed.
 * `$match` is left to the caller, since only the scope differs between the
 * league feed and the player's.
 */
function feedFor(match: Filter<NotificationDoc>): object[] {
  return [
    {
      $lookup: {
        from: COLLECTIONS.contracts,
        localField: "contractId",
        foreignField: "_id",
        as: "contract",
      },
    },
    { $unwind: "$contract" },
    {
      $lookup: {
        from: COLLECTIONS.teams,
        localField: "contract.teamId",
        foreignField: "_id",
        as: "team",
      },
    },
    { $unwind: "$team" },
    { $match: match },
    ...teamCreditsStages("team._id"),
    {
      $lookup: {
        from: COLLECTIONS.players,
        localField: "team.playerId",
        foreignField: "_id",
        as: "player",
      },
    },
    { $unwind: "$player" },
    { $sort: { date: -1 } },
    {
      $project: {
        _id: 0,
        id: "$_id",
        message: 1,
        date: 1,
        isRead: 1,
        contractId: "$contract._id",
        articleId: "$contract.articleId",
        purchaseDate: "$contract.purchaseDate",
        expireDate: "$contract.expireDate",
        purchasePrice: "$contract.purchasePrice",
        teamId: "$team._id",
        teamName: "$team.name",
        credits: 1,
        leagueId: "$team.leagueId",
        playerId: "$player._id",
        playerName: "$player.username",
      },
    },
  ];
}

export class NotificationRepositoryMongo implements NotificationRepository {
  constructor(private readonly store: MongoStore) {}

  async getByPlayerAndLeague(
    playerId: string,
    leagueId: string,
  ): Promise<Result<NotificationRow[]>> {
    return this.feed({ "team.playerId": playerId, "team.leagueId": leagueId });
  }

  async getByPlayerId(playerId: string): Promise<Result<NotificationRow[]>> {
    return this.feed({ "team.playerId": playerId });
  }

  async markAsRead(id: string, playerId: string): Promise<Result<void>> {
    try {
      const { notifications, contracts, teams } =
        await this.store.collections();
      const notification = await notifications.findOne({ _id: id });
      // Two distinct answers, because the route turns them into 404 and 403.
      if (!notification) return failure(NOTIFICATION_ERRORS.NOT_FOUND);

      const contract = await contracts.findOne({
        _id: notification.contractId,
      });
      const team = contract
        ? await teams.findOne({ _id: contract.teamId })
        : null;
      if (!team || team.playerId !== playerId) {
        return failure(NOTIFICATION_ERRORS.NOT_AUTHORIZED);
      }

      await notifications.updateOne({ _id: id }, { $set: { isRead: true } });
      return success(undefined);
    } catch (error) {
      return failure(
        `Error marking notification as read: ${errorMessage(error)}`,
      );
    }
  }

  async create(notification: NewNotification): Promise<Result<void>> {
    try {
      const { notifications } = await this.store.collections();
      await notifications.insertOne({
        _id: notification.id,
        contractId: notification.contractId,
        message: notification.message,
        date: notification.date,
        isRead: false,
      });
      return success(undefined);
    } catch (error) {
      return failure(`Error creating notification: ${errorMessage(error)}`);
    }
  }

  private async feed(
    match: Filter<NotificationDoc>,
  ): Promise<Result<NotificationRow[]>> {
    try {
      const { notifications } = await this.store.collections();
      const rows = await notifications
        .aggregate<NotificationRow>(feedFor(match))
        .toArray();
      return success(rows);
    } catch (error) {
      return failure(`Error fetching notifications: ${errorMessage(error)}`);
    }
  }
}
