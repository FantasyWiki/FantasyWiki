import { describe, expect, it } from "vitest";
import { DashboardData, type TeamPointsData } from "@/types/models";
import type { TeamDTO } from "../../../dto/teamDTO";
import type { LeagueDTO } from "../../../dto/leagueDTO";

function makeTeam(id: string): TeamDTO {
  return {
    id,
    name: `Team ${id}`,
    credits: 0,
    player: { id: `player-${id}`, name: `Player ${id}` },
  };
}

function makeDashboard(
  viewerTeamId: string,
  teams: TeamDTO[],
  rank: number,
  totalPlayers?: number
): DashboardData {
  const viewer = teams.find((t) => t.id === viewerTeamId)!;
  const league = { id: "league-1", teams } as unknown as LeagueDTO;
  const recentPoints: TeamPointsData = { yesterdayPoints: 0, pointsChange: 0 };
  return new DashboardData(
    viewer,
    league,
    [],
    [],
    recentPoints,
    rank,
    totalPlayers ?? teams.length,
    0
  );
}

describe("DashboardData.rank", () => {
  it("exposes the rank passed in by the caller", () => {
    const teams = [makeTeam("a"), makeTeam("b"), makeTeam("c")];
    expect(makeDashboard("b", teams, 1).rank).toBe(1);
    expect(makeDashboard("c", teams, 2).rank).toBe(2);
    expect(makeDashboard("a", teams, 3).rank).toBe(3);
  });

  it("returns a stable value across repeated reads", () => {
    const dashboard = makeDashboard("a", [makeTeam("a"), makeTeam("b")], 2);
    const first = dashboard.rank;
    const second = dashboard.rank;
    expect(first).toBe(2);
    expect(second).toBe(first);
  });
});
