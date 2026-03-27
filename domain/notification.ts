import { Temporal } from "@js-temporal/polyfill";

export interface Notification {
  id: string;
  contractId: string;
  message: string;
  date: Temporal.PlainDate;
  isRead: boolean;
}