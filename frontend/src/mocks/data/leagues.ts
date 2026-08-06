import { Temporal } from "@js-temporal/polyfill";
import type { LeagueDTO } from "../../../../dto/leagueDTO";
import type { TeamDTO } from "../../../../dto/teamDTO";
import { LeagueVisibility } from "../../../../model/enums";
import { globalFillerTeams, teams } from "./teams";

const Instant = Temporal.Instant;

/**
 * Who plays in each league. Held apart from the leagues themselves because
 * `LeagueDTO` deliberately carries no roster — the real API answers that with
 * the leaderboard. The handlers use this as their stand-in database whenever
 * they need to know which teams a league-scoped endpoint is talking about.
 */
export const rostersByLeague: Record<string, TeamDTO[]> = {
  // teams[1] is the current player's; the rest are filler rivals so the
  // standings card has a deep enough table to window.
  global: [teams[1], teams[5], ...globalFillerTeams],
  italy: [teams[0], teams[3], teams[4]],
  europe: [teams[2], teams[6]],
  americas: [teams[7]],
};

export function rosterOf(leagueId: string): TeamDTO[] {
  return rostersByLeague[leagueId] ?? [];
}

/**
 * `teamCount` is derived from the roster above rather than written out, so the
 * number the league section renders cannot drift from the teams the standings
 * endpoint actually returns.
 */
export const leagues: LeagueDTO[] = [
  {
    id: "global",
    title: "Global League",
    icon: "🌍",
    domain: "en",
    startDate: Instant.from("2024-01-01T00:00:00Z"),
    // Deliberately far out, mirroring the sentinel the real Global League is
    // seeded with (migration 0002): it keeps this league permanently in
    // progress, so the league page's running state — countdown and season
    // progress — is what mock mode shows by default. The other leagues have
    // already finished and exercise the podium.
    endDate: Instant.from("2100-12-31T23:59:59Z"),
    visibility: LeagueVisibility.PUBLIC,
    teamCount: rosterOf("global").length,
  },
  {
    id: "italy",
    title: "Italia League",
    icon: "🍕",
    domain: "it",
    startDate: Instant.from("2024-01-01T00:00:00Z"),
    endDate: Instant.from("2024-02-28T23:59:59Z"),
    // The one private fixture, so mock mode shows both badges.
    visibility: LeagueVisibility.PRIVATE,
    teamCount: rosterOf("italy").length,
  },
  {
    id: "europe",
    title: "Europe League",
    icon: "🇪🇺",
    domain: "en",
    startDate: Instant.from("2024-01-01T00:00:00Z"),
    endDate: Instant.from("2024-03-15T23:59:59Z"),
    visibility: LeagueVisibility.PUBLIC,
    teamCount: rosterOf("europe").length,
  },
  {
    id: "americas",
    title: "Americas League",
    icon: "🌎",
    domain: "en",
    startDate: Instant.from("2024-01-01T00:00:00Z"),
    endDate: Instant.from("2024-03-20T23:59:59Z"),
    visibility: LeagueVisibility.PUBLIC,
    teamCount: rosterOf("americas").length,
  },
];
