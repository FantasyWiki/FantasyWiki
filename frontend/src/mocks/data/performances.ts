import { Temporal } from "@js-temporal/polyfill";
import type { PerformanceDTO } from "../../../../dto/performanceDTO";
import type { FormationDTO } from "../../../../dto/formationDTO";
import { mockFullFormation433 } from "@/mocks/formationMocks";

const d = (s: string) => Temporal.PlainDate.from(s);

// Two snapshot dates used across all leagues
const TODAY = d("2026-06-27");
const YESTERDAY = d("2026-06-26");

function perf(
  teamId: string,
  date: Temporal.PlainDate,
  points: number
): PerformanceDTO {
  return {
    teamId,
    date,
    points,
    formation: mockFullFormation433 as unknown as FormationDTO,
  };
}

// Per-league performances, each team with 2 entries ordered date DESC.
// The handler filters by leagueId and returns the matching slice.
export const performancesByLeague: Record<string, PerformanceDTO[]> = {
  global: [
    perf("team-2", TODAY, 1380),
    perf("team-2", YESTERDAY, 1210),
    perf("team-6", TODAY, 1540),
    perf("team-6", YESTERDAY, 1600),
  ],
  italy: [
    perf("team-1", TODAY, 920),
    perf("team-1", YESTERDAY, 870),
    perf("team-4", TODAY, 1100),
    perf("team-4", YESTERDAY, 980),
    perf("team-5", TODAY, 760),
    perf("team-5", YESTERDAY, 810),
  ],
  europe: [
    perf("team-3", TODAY, 1050),
    perf("team-3", YESTERDAY, 1120),
    perf("team-7", TODAY, 990),
    perf("team-7", YESTERDAY, 890),
  ],
};
