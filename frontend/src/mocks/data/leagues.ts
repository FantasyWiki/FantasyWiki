import { Temporal } from "@js-temporal/polyfill";
import type { LeagueDTO } from "../../../../dto/leagueDTO";
import { globalFillerTeams, teams } from "./teams";

const Instant = Temporal.Instant;

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
    // teams[1] is the current player's; the rest are filler rivals so the
    // standings card has a deep enough table to window.
    teams: [teams[1], teams[5], ...globalFillerTeams],
  },
  {
    id: "italy",
    title: "Italia League",
    icon: "🍕",
    domain: "it",
    startDate: Instant.from("2024-01-01T00:00:00Z"),
    endDate: Instant.from("2024-02-28T23:59:59Z"),
    teams: [teams[0], teams[3], teams[4]],
  },
  {
    id: "europe",
    title: "Europe League",
    icon: "🇪🇺",
    domain: "en",
    startDate: Instant.from("2024-01-01T00:00:00Z"),
    endDate: Instant.from("2024-03-15T23:59:59Z"),
    teams: [teams[2], teams[6]],
  },
  {
    id: "americas",
    title: "Americas League",
    icon: "🌎",
    domain: "en",
    startDate: Instant.from("2024-01-01T00:00:00Z"),
    endDate: Instant.from("2024-03-20T23:59:59Z"),
    teams: [teams[7]],
  },
];
