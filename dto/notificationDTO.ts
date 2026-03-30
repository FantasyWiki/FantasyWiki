import { Temporal } from "@js-temporal/polyfill";
import { ContractDTO } from "./contractDTO";

export interface NotificationDTO {
  id: string;
  contract: ContractDTO;
  message: string;
  date: Temporal.PlainDate;
  isRead: boolean;
  //type: "contract_expiring" | "trade_offer" | "league_update" | "general";
  read: boolean;
}
