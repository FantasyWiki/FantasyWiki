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
  // The one finished league, so it is the only fixture the final podium and the
  // Ended Leagues section have — padded to a full three so the podium it stages
  // is a real one.
  americas: [teams[7], ...globalFillerTeams.slice(0, 3)],
  // Nobody from the current player here, on purpose — see `publicLeagues`.
  "open-science": globalFillerTeams.slice(0, 4),
  // One team, so the singular of the participant count is rendered somewhere.
  "open-cinema": globalFillerTeams.slice(1, 2),
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
    // progress — is what mock mode shows by default.
    //
    // It cannot double as the lifecycle fixture, though: it is the one league
    // nobody may leave. `italy` and `europe` run alongside it for that, and
    // `americas` is the finished one.
    endDate: Instant.from("2100-12-31T23:59:59Z"),
    visibility: LeagueVisibility.PUBLIC,
    teamCount: rosterOf("global").length,
    closedAt: null,
  },
  {
    id: "italy",
    title: "Italia League",
    icon: "🍕",
    domain: "it",
    startDate: Instant.from("2024-01-01T00:00:00Z"),
    // Running, and the current player is an ordinary member of it — which
    // makes this the one fixture that offers **Leave**. Every league here used
    // to have finished, so the lifecycle footer was unreachable in mock mode
    // however correct it was: an ended league offers neither action.
    endDate: Instant.from("2099-12-31T23:59:59Z"),
    // The one private fixture, so mock mode shows both badges.
    visibility: LeagueVisibility.PRIVATE,
    teamCount: rosterOf("italy").length,
    closedAt: null,
  },
  {
    id: "europe",
    title: "Europe League",
    icon: "🇪🇺",
    domain: "en",
    startDate: Instant.from("2024-01-01T00:00:00Z"),
    // Running, and the current player admins this one (see `adminLeagueIds` in
    // the handlers) — so it is the fixture that offers **Close**, and pointedly
    // not Leave: an admin closes the league instead of walking out of it.
    endDate: Instant.from("2099-12-31T23:59:59Z"),
    visibility: LeagueVisibility.PUBLIC,
    teamCount: rosterOf("europe").length,
    closedAt: null,
  },
  {
    id: "americas",
    title: "Americas League",
    icon: "🌎",
    domain: "en",
    startDate: Instant.from("2024-01-01T00:00:00Z"),
    // The finished one: the Ended Leagues section's only entry, the final
    // podium's fixture, and the league that proves neither lifecycle control
    // is offered once a season is over.
    endDate: Instant.from("2024-03-20T23:59:59Z"),
    visibility: LeagueVisibility.PUBLIC,
    teamCount: rosterOf("americas").length,
    closedAt: null,
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
    closedAt: null,
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
    closedAt: null,
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
    closedAt: null,
  },
];

/**
 * Every league the mock knows about, joined or not — what the by-id lookup has
 * to search, so a featured card actually opens its league page.
 */
export function allLeagues(): LeagueDTO[] {
  return [...leagues, ...publicLeagues];
}
