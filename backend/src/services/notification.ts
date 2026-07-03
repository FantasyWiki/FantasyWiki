import { Temporal } from "@js-temporal/polyfill";
import { Domain } from "../../../model/enums";
import { RawNotification } from "../../../dto/notificationDTO";
import { RawContract } from "../../../dto/contractDTO";
import {
  NotificationRepository,
  NotificationRow,
} from "../repositories/notificationRepository";
import { NotificationRepositoryD1 } from "../repositories/d1/notificationRepositoryD1";
import { LeagueRepository } from "../repositories/leagueRepository";
import { LeagueRepositoryD1 } from "../repositories/d1/leagueRepositoryD1";
import { Result, success, failure } from "../repositories/result";
import { toRawContract } from "./rawContract";

export type NotificationServiceDeps = {
  notificationRepository: NotificationRepository;
  leagueRepository: LeagueRepository;
};

function rowToRawContract(row: NotificationRow, domain: Domain): RawContract {
  return toRawContract(
    {
      id: row.contractId,
      teamId: row.teamId,
      articleId: row.articleId,
      purchaseDate: Temporal.PlainDate.from(row.purchaseDate),
      expireDate: Temporal.PlainDate.from(row.expireDate),
      purchasePrice: row.purchasePrice,
      settled: false,
      renewalCount: 0,
      renewalElected: false,
    },
    { id: row.teamId, name: row.teamName, credits: row.credits },
    { id: row.playerId, name: row.playerName },
    domain,
  );
}

export class NotificationService {
  private repository: NotificationRepository;
  private leagueRepository: LeagueRepository;

  constructor(depsOrDb: NotificationServiceDeps | D1Database) {
    const deps =
      "notificationRepository" in depsOrDb
        ? depsOrDb
        : NotificationService.d1Deps(depsOrDb as D1Database);
    this.repository = deps.notificationRepository;
    this.leagueRepository = deps.leagueRepository;
  }

  private static d1Deps(db: D1Database): NotificationServiceDeps {
    return {
      notificationRepository: new NotificationRepositoryD1(db),
      leagueRepository: new LeagueRepositoryD1(db),
    };
  }

  async getMyNotifications(
    playerId: string,
    leagueId: string,
  ): Promise<Result<RawNotification[]>> {
    const rowsResult = await this.repository.getByPlayerAndLeague(
      playerId,
      leagueId,
    );
    if (!rowsResult.ok) {
      return rowsResult;
    }
    return this.toRawNotifications(rowsResult.value);
  }

  async getAllForPlayer(playerId: string): Promise<Result<RawNotification[]>> {
    const rowsResult = await this.repository.getByPlayerId(playerId);
    if (!rowsResult.ok) {
      return rowsResult;
    }
    return this.toRawNotifications(rowsResult.value);
  }

  async markAsRead(
    notificationId: string,
    playerId: string,
  ): Promise<Result<void>> {
    return this.repository.markAsRead(notificationId, playerId);
  }

  private async toRawNotifications(
    rows: NotificationRow[],
  ): Promise<Result<RawNotification[]>> {
    const uniqueLeagueIds = [...new Set(rows.map((r) => r.leagueId))];
    const leagueResults = await Promise.all(
      uniqueLeagueIds.map((id) => this.leagueRepository.getById(id)),
    );

    const domainByLeague = new Map<string, Domain>();
    for (let i = 0; i < uniqueLeagueIds.length; i++) {
      const result = leagueResults[i];
      if (!result.ok) return result;
      domainByLeague.set(uniqueLeagueIds[i], result.value.domain as Domain);
    }

    const notifications: RawNotification[] = [];
    for (const row of rows) {
      const domain = domainByLeague.get(row.leagueId);
      if (domain === undefined)
        return failure(`Domain not found for league ${row.leagueId}`);
      notifications.push({
        id: row.id,
        leagueId: row.leagueId,
        contract: rowToRawContract(row, domain),
        message: row.message,
        date: row.date,
        isRead: row.isRead,
      });
    }
    return success(notifications);
  }
}
