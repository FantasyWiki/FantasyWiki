import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import { LeaderboardService } from "../../services/leaderboard";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import { PlayerService } from "../../services/player";
import { TeamService } from "../../services/team";
import { unwrap } from "../../repositories/result";
import { repositories } from "../support/target";
import type { Team } from "../../../../model";

const TEAM_NAMES = ["Alpha FC", "Beta FC", "Gamma FC"];

async function score(
  teamId: string,
  date: string,
  points: number,
): Promise<void> {
  unwrap(
    await repositories().performances.upsertDaily(
      Temporal.PlainDate.from(date),
      [{ teamId, points, formationSnapshot: "{}" }],
    ),
    "performance",
  );
}

describe("LeaderboardService.getLeaderboard", () => {
  let teams: Map<string, Team>;
  const teamId = (name: string) => teams.get(name)!.id;

  beforeEach(async () => {
    teams = new Map();
    const players = new PlayerService(repositories());
    const teamService = new TeamService(repositories());

    for (const name of TEAM_NAMES) {
      const handle = name.toLowerCase().replace(/\s/g, "");
      const player = unwrap(
        await players.createPlayer(handle, `${handle}@e.com`, `acc-${handle}`),
        "player",
      );
      teams.set(
        name,
        unwrap(
          await teamService.createTeam(player.id, GLOBAL_LEAGUE_ID, name),
          "team",
        ),
      );
    }
  });

  // Day one: the standings are the only place the league's roster is visible, so
  // a league whose first scoring day has not closed must still list every team
  // rather than come back empty.
  it("lists every team in the league before any scoring has happened", async () => {
    const result = await new LeaderboardService(repositories()).getLeaderboard(
      GLOBAL_LEAGUE_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(TEAM_NAMES.length);
    expect(result.value.map((e) => e.team.name).sort()).toEqual([
      "Alpha FC",
      "Beta FC",
      "Gamma FC",
    ]);
    // Everyone level, and no rank movement to claim: there is no earlier day to
    // have moved from.
    expect(result.value.every((e) => e.cumulativePoints === 0)).toBe(true);
    expect(result.value.every((e) => e.rankDelta === null)).toBe(true);
    expect(result.value.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it("keeps an unscored team in the table alongside scored ones", async () => {
    await score(teamId("Alpha FC"), "2026-07-28", 40);
    await score(teamId("Beta FC"), "2026-07-28", 10);

    const result = await new LeaderboardService(repositories()).getLeaderboard(
      GLOBAL_LEAGUE_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(TEAM_NAMES.length);
    const gamma = result.value.find((e) => e.team.id === teamId("Gamma FC"));
    expect(gamma).toBeDefined();
    expect(gamma!.cumulativePoints).toBe(0);
    expect(gamma!.rank).toBe(3);
  });

  it("ranks by cumulative points and reports movement against the previous day", async () => {
    // Beta led after day one, Alpha's day two overtakes it.
    await score(teamId("Alpha FC"), "2026-07-27", 10);
    await score(teamId("Beta FC"), "2026-07-27", 30);
    await score(teamId("Alpha FC"), "2026-07-28", 50);
    await score(teamId("Beta FC"), "2026-07-28", 5);

    const result = await new LeaderboardService(repositories()).getLeaderboard(
      GLOBAL_LEAGUE_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const alpha = result.value.find((e) => e.team.id === teamId("Alpha FC"))!;
    const beta = result.value.find((e) => e.team.id === teamId("Beta FC"))!;
    expect(alpha.cumulativePoints).toBe(60);
    expect(alpha.rank).toBe(1);
    expect(alpha.rankDelta).toBe(1);
    expect(beta.rank).toBe(2);
    expect(beta.rankDelta).toBe(-1);
  });
});
