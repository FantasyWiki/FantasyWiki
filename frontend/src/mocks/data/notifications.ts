import { Temporal } from "@js-temporal/polyfill";
import type { NotificationDTO } from "../../../../dto/notificationDTO";
import { contracts } from "./contracts";

export const notifications: NotificationDTO[] = [
  {
    id: "notif-1",
    leagueId: "italy",
    contract: contracts[0],
    message: "Contratto in scadenza: Bitcoin",
    date: Temporal.PlainDate.from("2024-02-09"),
    isRead: false,
  },
  {
    id: "notif-2",
    leagueId: "global",
    contract: contracts[5],
    message: "Contract expiring soon: Cloud Computing",
    date: Temporal.PlainDate.from("2024-02-09"),
    isRead: false,
  },
  {
    id: "notif-3",
    leagueId: "italy",
    contract: contracts[1],
    message: "Attenzione: il contratto per Ethereum scade a breve",
    date: Temporal.PlainDate.from("2024-02-12"),
    isRead: false,
  },
  {
    id: "notif-4",
    leagueId: "italy",
    contract: contracts[3],
    message: "Contratto terminato per Machine Learning",
    date: Temporal.PlainDate.from("2024-02-15"),
    isRead: true,
  },
  {
    id: "notif-5",
    leagueId: "global",
    contract: contracts[4],
    message: "Contract update: Artificial Intelligence usage increased",
    date: Temporal.PlainDate.from("2024-02-18"),
    isRead: false,
  },
];


