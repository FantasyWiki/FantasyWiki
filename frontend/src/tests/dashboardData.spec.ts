import { describe, expect, it } from "vitest";
import { DashboardData, type TeamPointsData } from "@/types/models";
import type { TeamDTO } from "../../../dto/teamDTO";
import type { LeagueDTO } from "../../../dto/leagueDTO";

function makeTeam(id: string, points: number): TeamDTO {
  return {
    id,
    name: `Team ${id}`,
    credits: 0,
    player: { id: `player-${id}`, name: `Player ${id}` },
    points,
  };
}

function makeDashboard(viewerTeamId: string, teams: TeamDTO[]): DashboardData {
  const viewer = teams.find((t) => t.id === viewerTeamId)!;
  const league = { id: "league-1", teams } as unknown as LeagueDTO;
  const recentPoints: TeamPointsData = { yesterdayPoints: 0, pointsChange: 0 };
  return new DashboardData(viewer, league, [], [], recentPoints);
}

describe("DashboardData.rank", () => {
  it("ranks the viewer team by descending points (1-based)", () => {
    const teams = [makeTeam("a", 10), makeTeam("b", 30), makeTeam("c", 20)];
    expect(makeDashboard("b", teams).rank).toBe(1);
    expect(makeDashboard("c", teams).rank).toBe(2);
    expect(makeDashboard("a", teams).rank).toBe(3);
  });

  it("returns a stable value across repeated reads", () => {
    const dashboard = makeDashboard("a", [
      makeTeam("a", 10),
      makeTeam("b", 30),
    ]);
    const first = dashboard.rank;
    const second = dashboard.rank;
    expect(first).toBe(2);
    expect(second).toBe(first);
  });

  it("does not mutate the source teams array when computing rank", () => {
    const teams = [makeTeam("a", 10), makeTeam("b", 30), makeTeam("c", 20)];
    const order = teams.map((t) => t.id);
    void makeDashboard("a", teams).rank;
    expect(teams.map((t) => t.id)).toEqual(order);
  });
});
