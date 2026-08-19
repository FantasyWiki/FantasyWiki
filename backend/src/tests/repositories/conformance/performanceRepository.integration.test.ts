import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect } from "vitest";
import { unwrap } from "../../../repositories/result";
import { GLOBAL_LEAGUE_ID } from "../../../services/league";
import { repositories } from "../../support/target";
import { aTeamIn } from "../../support/subjects";
import { STARTING_CREDITS } from "../../../../../model/team";

const DAY_ONE = Temporal.PlainDate.from("2026-07-12");
const DAY_TWO = Temporal.PlainDate.from("2026-07-13");

/**
 * What any PerformanceRepository owes its callers. The scoring engine runs daily
 * and its sweep can be re-run, so the write is keyed on (team, date) and
 * recomputes rather than appending.
 */
describe("PerformanceRepository conformance", () => {
  it("recomputes a day rather than duplicating it", async () => {
    const performances = repositories().performances;
    const team = await aTeamIn(GLOBAL_LEAGUE_ID);

    unwrap(
      await performances.upsertDaily(DAY_ONE, [
        { teamId: team.id, points: 9.5, formationSnapshot: "{}" },
      ]),
      "first ingest",
    );
    unwrap(
      await performances.upsertDaily(DAY_ONE, [
        { teamId: team.id, points: 1, formationSnapshot: "{}" },
      ]),
      "re-ingest",
    );

    const recent = unwrap(
      await performances.getRecentByTeam(team.id, 5),
      "recent performances",
    );
    expect(recent).toHaveLength(1);
    expect(recent[0].points).toBeCloseTo(1);
  });

  it("keeps a row per day, most recent first", async () => {
    const performances = repositories().performances;
    const team = await aTeamIn(GLOBAL_LEAGUE_ID);

    unwrap(
      await performances.upsertDaily(DAY_ONE, [
        { teamId: team.id, points: 3, formationSnapshot: "{}" },
      ]),
      "day one",
    );
    unwrap(
      await performances.upsertDaily(DAY_TWO, [
        { teamId: team.id, points: 4, formationSnapshot: "{}" },
      ]),
      "day two",
    );

    const recent = unwrap(
      await performances.getRecentByTeam(team.id, 5),
      "recent performances",
    );

    // The dashboard reads the newest first and takes a handful.
    expect(recent.map((row) => row.points)).toEqual([4, 3]);
  });

  it("honours the limit it is given", async () => {
    const performances = repositories().performances;
    const team = await aTeamIn(GLOBAL_LEAGUE_ID);
    unwrap(
      await performances.upsertDaily(DAY_ONE, [
        { teamId: team.id, points: 3, formationSnapshot: "{}" },
      ]),
      "day one",
    );
    unwrap(
      await performances.upsertDaily(DAY_TWO, [
        { teamId: team.id, points: 4, formationSnapshot: "{}" },
      ]),
      "day two",
    );

    expect(
      unwrap(await performances.getRecentByTeam(team.id, 1), "one day"),
    ).toHaveLength(1);
  });

  it("writes a whole sweep's worth of teams in one call", async () => {
    const performances = repositories().performances;
    const first = await aTeamIn(GLOBAL_LEAGUE_ID);
    const second = await aTeamIn(GLOBAL_LEAGUE_ID);

    unwrap(
      await performances.upsertDaily(DAY_ONE, [
        { teamId: first.id, points: 7, formationSnapshot: "{}" },
        { teamId: second.id, points: 2, formationSnapshot: "{}" },
      ]),
      "sweep",
    );

    expect(
      unwrap(await performances.getRecentByTeam(first.id, 5), "first team")[0]
        .points,
    ).toBeCloseTo(7);
    expect(
      unwrap(await performances.getRecentByTeam(second.id, 5), "second team")[0]
        .points,
    ).toBeCloseTo(2);
  });

  it("ranks a league by cumulative points, listing teams that have none", async () => {
    const performances = repositories().performances;
    const scored = await aTeamIn(GLOBAL_LEAGUE_ID);
    const unscored = await aTeamIn(GLOBAL_LEAGUE_ID);
    unwrap(
      await performances.upsertDaily(DAY_ONE, [
        { teamId: scored.id, points: 10, formationSnapshot: "{}" },
      ]),
      "day one",
    );
    unwrap(
      await performances.upsertDaily(DAY_TWO, [
        { teamId: scored.id, points: 5, formationSnapshot: "{}" },
      ]),
      "day two",
    );

    const table = unwrap(
      await performances.getLeagueCumulatives(GLOBAL_LEAGUE_ID),
      "cumulatives",
    );

    const scoredRow = table.find((row) => row.teamId === scored.id);
    expect(scoredRow?.cumulativeLatest).toBeCloseTo(15);
    // Yesterday's standing, which is what a rank delta is measured against.
    expect(scoredRow?.cumulativePrevious).toBeCloseTo(10);

    // The standings are the only place a league's roster is visible, so a team
    // that has never scored still has to appear — with its balance.
    const unscoredRow = table.find((row) => row.teamId === unscored.id);
    expect(unscoredRow?.cumulativeLatest).toBe(0);
    expect(unscoredRow?.teamCredits).toBe(STARTING_CREDITS);
  });
});
