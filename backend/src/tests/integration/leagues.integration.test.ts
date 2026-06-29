import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect } from "vitest";
import { toLeagueDTO } from "../../services/leagues";
import { League } from "../../../../model";

describe("toLeagueDTO", () => {
  it("maps a domain League to the list-endpoint LeagueDTO shape", () => {
    const startDate = Temporal.Instant.from("2026-01-01T00:00:00Z");
    const endDate = Temporal.Instant.from("2026-12-31T00:00:00Z");
    const league: League = {
      id: "league-7",
      name: "Trivia Titans",
      adminId: "player-1",
      startDate,
      endDate,
      domain: "it",
      icon: "🏆",
    };

    const dto = toLeagueDTO(league);

    expect(dto).toEqual({
      id: "league-7",
      title: "Trivia Titans",
      description: "",
      domain: "it",
      icon: "🏆",
      startDate,
      endDate,
      teams: [],
    });
  });
});
