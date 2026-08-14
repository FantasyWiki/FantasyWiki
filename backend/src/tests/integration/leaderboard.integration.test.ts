import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import { LeaderboardService } from "../../services/leaderboard";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import { insertTeam } from "../utils/d1TestUtils";

const TEAMS = [
  { id: "team-lb-1", name: "Alpha FC", playerId: "player-lb-1" },
  { id: "team-lb-2", name: "Beta FC", playerId: "player-lb-2" },
  { id: "team-lb-3", name: "Gamma FC", playerId: "player-lb-3" },
];

async function insertPerformance(
  teamId: string,
  date: string,
  points: number,
): Promise<void> {
  await env.db
    .prepare(
      "INSERT INTO performances (teamId, date, points, historical_formation) VALUES (?, ?, ?, ?)",
    )
    .bind(teamId, date, points, "{}")
    .run();
}

describe("LeaderboardService.getLeaderboard", () => {
  beforeEach(async () => {
    for (const team of TEAMS) {
      await env.db
        .prepare(
          "INSERT INTO google_accounts (id, googleId, email) VALUES (?, ?, ?)",
        )
        .bind(
          `acc-${team.playerId}`,
          `gid-${team.playerId}`,
          `${team.id}@e.com`,
        )
        .run();
      await env.db
        .prepare(
          "INSERT INTO players (id, username, accountId) VALUES (?, ?, ?)",
        )
        .bind(team.playerId, team.name, `acc-${team.playerId}`)
        .run();
      await insertTeam(env.db, { ...team, leagueId: GLOBAL_LEAGUE_ID });
    }
  });

  // Day one: the standings are the only place the league's roster is visible, so
  // a league whose first scoring day has not closed must still list every team
  // rather than come back empty.
  it("lists every team in the league before any scoring has happened", async () => {
    const result = await new LeaderboardService(env.db).getLeaderboard(
      GLOBAL_LEAGUE_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(TEAMS.length);
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
    await insertPerformance("team-lb-1", "2026-07-28", 40);
    await insertPerformance("team-lb-2", "2026-07-28", 10);

    const result = await new LeaderboardService(env.db).getLeaderboard(
      GLOBAL_LEAGUE_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(TEAMS.length);
    const gamma = result.value.find((e) => e.team.id === "team-lb-3");
    expect(gamma).toBeDefined();
    expect(gamma!.cumulativePoints).toBe(0);
    expect(gamma!.rank).toBe(3);
  });

  it("ranks by cumulative points and reports movement against the previous day", async () => {
    // Beta led after day one, Alpha's day two overtakes it.
    await insertPerformance("team-lb-1", "2026-07-27", 10);
    await insertPerformance("team-lb-2", "2026-07-27", 30);
    await insertPerformance("team-lb-1", "2026-07-28", 50);
    await insertPerformance("team-lb-2", "2026-07-28", 5);

    const result = await new LeaderboardService(env.db).getLeaderboard(
      GLOBAL_LEAGUE_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const alpha = result.value.find((e) => e.team.id === "team-lb-1")!;
    const beta = result.value.find((e) => e.team.id === "team-lb-2")!;
    expect(alpha.cumulativePoints).toBe(60);
    expect(alpha.rank).toBe(1);
    expect(alpha.rankDelta).toBe(1);
    expect(beta.rank).toBe(2);
    expect(beta.rankDelta).toBe(-1);
  });
});
