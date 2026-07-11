import { Result } from "./result";

export const NOTIFICATION_ERRORS = {
  NOT_FOUND: "Notification not found",
  NOT_AUTHORIZED: "Notification not authorized",
} as const;

export type NotificationRow = {
  id: string;
  message: string;
  date: string;
  isRead: boolean;
  contractId: string;
  articleId: string;
  purchaseDate: string;
  expireDate: string;
  purchasePrice: number;
  teamId: string;
  teamName: string;
  credits: number;
  leagueId: string;
  playerId: string;
  playerName: string;
};

export interface NewNotification {
  id: string;
  contractId: string;
  message: string;
  date: string;
}

export interface NotificationRepository {
  getByPlayerAndLeague(
    playerId: string,
    leagueId: string,
  ): Promise<Result<NotificationRow[]>>;
  getByPlayerId(playerId: string): Promise<Result<NotificationRow[]>>;
  markAsRead(id: string, playerId: string): Promise<Result<void>>;
  create(notification: NewNotification): Promise<Result<void>>;
}
