import { Temporal } from "@js-temporal/polyfill";
import type { LeagueDTO } from "../../../../dto/leagueDTO";
import { teams } from "./teams";

const Instant = Temporal.Instant;

export const leagues: LeagueDTO[] = [
  {
    id: "global",
    title: "Global League",
    icon: "🌍",
    domain: "en",
    startDate: Instant.from("2024-01-01T00:00:00Z"),
    endDate: Instant.from("2024-12-31T23:59:59Z"),
    teams: [teams[1], teams[5]],
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
