import { Temporal } from "@js-temporal/polyfill";
import { ContractDTO, RawContract } from "./contractDTO";

export type RawNotification = {
  id: string;
  leagueId: string;
  contract: RawContract;
  message: string;
  date: string;
  isRead: boolean;
};

export interface NotificationDTO {
  id: string;
  leagueId: string;
  contract: ContractDTO;
  message: string;
  date: Temporal.PlainDate;
  isRead: boolean;
  //type: "contract_expiring" | "trade_offer" | "league_update" | "general";
}

export function deserializeNotification(raw: RawNotification): NotificationDTO {
  return {
    ...raw,
    date: Temporal.PlainDate.from(raw.date),
    contract: ContractDTO.fromRaw(raw.contract),
  };
}
