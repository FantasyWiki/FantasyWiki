import { Temporal } from "@js-temporal/polyfill";
import { FormationDTO } from "./formationDTO";

export interface PerformanceDTO {
  teamId: string;
  date: Temporal.PlainDate;
  formation: FormationDTO;
  points: number;
}