import { describe, it, expect } from "vitest";
import { success } from "../../../repositories/result";
import { anotherLeague, aTeamIn } from "../../support/subjects";
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
