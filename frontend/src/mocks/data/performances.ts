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
  // Cumulative = sum of a team's entries, so these totals put the current
  // player's team (team-2, 2590) 5th of 12. The card therefore windows on
  // ranks 3–7, pins the leader, and marks rank 2 as skipped.
  global: [
    perf("team-2", TODAY, 1380),
    perf("team-2", YESTERDAY, 1210),
    perf("team-6", TODAY, 1540),
    perf("team-6", YESTERDAY, 1600),
    perf("team-9", TODAY, 1850), // 3600 — 1st
    perf("team-9", YESTERDAY, 1750),
    perf("team-10", TODAY, 1500), // 2980 — 3rd
    perf("team-10", YESTERDAY, 1480),
    perf("team-11", TODAY, 1400), // 2740 — 4th
    perf("team-11", YESTERDAY, 1340),
    perf("team-12", TODAY, 1200), // 2410 — 6th
    perf("team-12", YESTERDAY, 1210),
    perf("team-13", TODAY, 1180), // 2250 — 7th
    perf("team-13", YESTERDAY, 1070),
    perf("team-14", TODAY, 1050), // 2090 — 8th
    perf("team-14", YESTERDAY, 1040),
    perf("team-15", TODAY, 960), // 1880 — 9th
    perf("team-15", YESTERDAY, 920),
    perf("team-16", TODAY, 830), // 1650 — 10th
    perf("team-16", YESTERDAY, 820),
    perf("team-17", TODAY, 700), // 1420 — 11th
    perf("team-17", YESTERDAY, 720),
    perf("team-18", TODAY, 600), // 1180 — 12th
    perf("team-18", YESTERDAY, 580),
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
