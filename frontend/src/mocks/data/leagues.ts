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
  // Nobody from the current player here, on purpose — see `publicLeagues`.
  "open-science": globalFillerTeams.slice(0, 4),
  "open-cinema": globalFillerTeams.slice(1, 3),
  "open-calcio": globalFillerTeams.slice(2, 6),
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

/**
 * Public leagues the current player has **no team in** — what the featured
 * shelf is for, and the only fixtures that exercise it. They are kept out of
 * `leagues` because that array is the answer to `GET /api/leagues`, which means
 * "the leagues I play"; a league appearing in both would defeat the filter the
 * shelf applies.
 *
 * All still running, since a finished league is not somewhere to go.
 */
export const publicLeagues: LeagueDTO[] = [
  {
    id: "open-science",
    title: "Open Science League",
    icon: "🔬",
    domain: "en",
    startDate: Instant.from("2026-07-01T00:00:00Z"),
    endDate: Instant.from("2027-01-01T00:00:00Z"),
    visibility: LeagueVisibility.PUBLIC,
    teamCount: rosterOf("open-science").length,
  },
  {
    id: "open-cinema",
    title: "Silver Screen League",
    icon: "🎭",
    domain: "en",
    startDate: Instant.from("2026-06-15T00:00:00Z"),
    endDate: Instant.from("2026-12-15T00:00:00Z"),
    visibility: LeagueVisibility.PUBLIC,
    teamCount: rosterOf("open-cinema").length,
  },
  {
    id: "open-calcio",
    title: "Calcio e Cultura",
    icon: "⚽",
    domain: "it",
    startDate: Instant.from("2026-08-01T00:00:00Z"),
    endDate: Instant.from("2026-11-01T00:00:00Z"),
    visibility: LeagueVisibility.PUBLIC,
    teamCount: rosterOf("open-calcio").length,
  },
];

/**
 * Every league the mock knows about, joined or not — what the by-id lookup has
 * to search, so a featured card actually opens its league page.
 */
export function allLeagues(): LeagueDTO[] {
  return [...leagues, ...publicLeagues];
}
