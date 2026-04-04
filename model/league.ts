import { Temporal } from "@js-temporal/polyfill";

export interface League {
  id: string;
  name: string;
  adminId: string;
  startDate: Temporal.Instant;
  endDate: Temporal.Instant;
  domain: string;
  icon: string;
}
