import { Temporal } from "@js-temporal/polyfill";
import { FormationDTO } from "./formationDTO";

export interface PerformanceDTO {
  teamId: number;
  date: Temporal.Instant;
  formation: FormationDTO;
  points: number;
}