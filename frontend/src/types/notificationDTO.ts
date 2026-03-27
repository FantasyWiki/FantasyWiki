import { Temporal } from "@js-temporal/polyfill";

export interface NotificationDTO {
  id: string;
  contractId: string;
  message: string;
  date: Temporal.PlainDate;
  isRead: boolean;
  //type: "contract_expiring" | "trade_offer" | "league_update" | "general";
  read: boolean;
}
