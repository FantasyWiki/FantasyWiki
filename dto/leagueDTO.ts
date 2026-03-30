import { Temporal } from "@js-temporal/polyfill";
import { TeamDTO } from "./teamDTO";
import { Enums } from "./enums";

export interface LeagueDTO {
  id: string;
  title: string;
  description: string;
  domain: Enums;
  icon: string;
  startDate: Temporal.Instant;
  endDate: Temporal.Instant;
  teams: TeamDTO[];
}