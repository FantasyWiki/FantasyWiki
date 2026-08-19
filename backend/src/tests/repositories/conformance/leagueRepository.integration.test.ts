import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect } from "vitest";
import { LEAGUE_ERRORS } from "../../../repositories/leagueRepository";
import { success, unwrap } from "../../../repositories/result";
import { anotherLeague, aPlayer, aTeamIn } from "../../support/subjects";
import { repositories } from "../../support/target";

/**
 * What a LeagueRepository owes its callers. Nothing here says how the answer is
 * arrived at — D1 counts with a `GROUP BY` over an `IN` list, and another target
 * may do it any way it likes, so long as these are the answers.
 */

const leagues = () => repositories().leagues;

describe("countTeamsByLeague", () => {
  it("counts every team in each requested league", async () => {
    const a = await anotherLeague();
    const b = await anotherLeague();
    // Each league already fields its founder's team, so these are the second
    // and third: two in `a`, one in `b`.
    await aTeamIn(a.id);
    await aTeamIn(a.id);
    await aTeamIn(b.id);

    const result = await leagues().countTeamsByLeague([a.id, b.id]);

    expect(result).toEqual(success({ [a.id]: 3, [b.id]: 2 }));
  });

  it("reports a league nobody else has joined as its founding team alone", async () => {
    const league = await anotherLeague();

    const result = await leagues().countTeamsByLeague([league.id]);

    expect(result).toEqual(success({ [league.id]: 1 }));
  });

  it("reports an id that is not a league at all as 0", async () => {
    // The caller indexes by id to build a DTO; a missing key would read as
    // undefined and render a blank where a zero belongs.
    const result = await leagues().countTeamsByLeague(["no-such-league"]);

    expect(result).toEqual(success({ "no-such-league": 0 }));
  });

  it("answers an empty id list with an empty count", async () => {
    const result = await leagues().countTeamsByLeague([]);

    expect(result).toEqual(success({}));
  });

  it("counts only the requested leagues", async () => {
    const asked = await anotherLeague();
    const unasked = await anotherLeague();
    await aTeamIn(asked.id);
    await aTeamIn(unasked.id);

    const result = await leagues().countTeamsByLeague([asked.id]);

    expect(result).toEqual(success({ [asked.id]: 2 }));
  });
});

/**
 * Closing is a *guarded* write, and these are the guarantees that come with
 * that: only the admin closes, only once, and a refusal changes nothing. D1 puts
 * all three conditions in the UPDATE because a check followed by a write is a
 * race — two closes would both find the column empty and the later one would
 * move the recorded end of the season. Another target may enforce them however
 * it likes, so long as the refusals below are the answers.
 */
describe("close", () => {
  async function closedAt(leagueId: string) {
    return unwrap(await leagues().getById(leagueId), "league").closedAt;
  }

  it("stamps the closure for the league's own admin", async () => {
    const league = await anotherLeague();
    const at = Temporal.Instant.from("2026-08-12T10:00:00Z");

    const result = await leagues().close(league.id, league.adminId, at);

    expect(result.ok).toBe(true);
    expect((await closedAt(league.id))?.toString()).toBe(at.toString());
  });

  it("refuses a caller who is not the league's admin, and writes nothing", async () => {
    // Authorization is a condition of the write, not a check before it. A
    // stranger reaching the repository directly — the shape of a concurrent
    // request that arrived while the admin check was being made elsewhere —
    // still cannot close the league.
    const league = await anotherLeague();

    const result = await leagues().close(
      league.id,
      await aPlayer(),
      Temporal.Now.instant(),
    );

    expect(result).toEqual({ ok: false, error: LEAGUE_ERRORS.CLOSE_CONFLICT });
    expect(await closedAt(league.id)).toBeNull();
  });

  it("refuses a second close and keeps the first moment", async () => {
    const league = await anotherLeague();
    const first = Temporal.Instant.from("2026-08-01T00:00:00Z");
    const second = Temporal.Instant.from("2026-08-02T00:00:00Z");
    unwrap(await leagues().close(league.id, league.adminId, first), "closure");

    const result = await leagues().close(league.id, league.adminId, second);

    expect(result).toEqual({ ok: false, error: LEAGUE_ERRORS.CLOSE_CONFLICT });
    expect((await closedAt(league.id))?.toString()).toBe(first.toString());
  });

  it("refuses a league that is not there", async () => {
    const result = await leagues().close(
      "no-such-league",
      "whoever",
      Temporal.Now.instant(),
    );

    expect(result).toEqual({ ok: false, error: LEAGUE_ERRORS.CLOSE_CONFLICT });
  });
});
