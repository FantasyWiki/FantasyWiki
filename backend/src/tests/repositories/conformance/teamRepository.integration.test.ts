import { describe, it, expect } from "vitest";
import { TEAM_ERRORS } from "../../../repositories/teamRepository";
import { unwrap } from "../../../repositories/result";
import { GLOBAL_LEAGUE_ID } from "../../../services/league";
import { repositories } from "../../support/target";
import { anotherLeague, aPlayer, unique } from "../../support/subjects";
import { STARTING_CREDITS } from "../../../../../model/team";

/** What any TeamRepository owes its callers. */
describe("TeamRepository conformance", () => {
  it("gives a brand-new team the starting budget", async () => {
    // Credits are never a create parameter: a team with no contracts has spent
    // nothing, so the derived balance is trivially the starting budget.
    const team = unwrap(
      await repositories().teams.create({
        name: unique("Fresh FC"),
        playerId: await aPlayer(),
        leagueId: GLOBAL_LEAGUE_ID,
      }),
      "team",
    );

    expect(team.credits).toBe(STARTING_CREDITS);
  });

  it("refuses a player a second team in the same league", async () => {
    const teams = repositories().teams;
    const playerId = await aPlayer();
    unwrap(
      await teams.create({
        name: unique("First FC"),
        playerId,
        leagueId: GLOBAL_LEAGUE_ID,
      }),
      "first team",
    );

    const second = await teams.create({
      name: unique("Second FC"),
      playerId,
      leagueId: GLOBAL_LEAGUE_ID,
    });

    expect(second.ok).toBe(false);
  });

  it("allows that player a team in another league", async () => {
    const teams = repositories().teams;
    const playerId = await aPlayer();
    const elsewhere = await anotherLeague();
    unwrap(
      await teams.create({
        name: unique("Home FC"),
        playerId,
        leagueId: GLOBAL_LEAGUE_ID,
      }),
      "home team",
    );

    const away = await teams.create({
      name: unique("Away FC"),
      playerId,
      leagueId: elsewhere.id,
    });

    expect(away.ok).toBe(true);
  });

  it("scopes a name's availability to one league", async () => {
    const teams = repositories().teams;
    const elsewhere = await anotherLeague();
    unwrap(
      await teams.create({
        name: "Shared Name",
        playerId: await aPlayer(),
        leagueId: GLOBAL_LEAGUE_ID,
      }),
      "team",
    );

    expect(
      unwrap(
        await teams.existsByNameInLeague("Shared Name", GLOBAL_LEAGUE_ID),
        "same league",
      ),
    ).toBe(true);
    expect(
      unwrap(
        await teams.existsByNameInLeague("Shared Name", elsewhere.id),
        "other league",
      ),
    ).toBe(false);
  });

  it("answers null — not a failure — when a player has no team in a league", async () => {
    // Every self-scoped feature hits this wall, and they all need to tell it
    // apart from a broken read to answer 404 rather than 500.
    const found = unwrap(
      await repositories().teams.getByPlayerAndLeague(
        await aPlayer(),
        GLOBAL_LEAGUE_ID,
      ),
      "team lookup",
    );

    expect(found).toBeNull();
    // The message the routes compare against by identity when they do 404.
    expect(TEAM_ERRORS.NO_TEAM_IN_LEAGUE).toBe("No team found for this league");
  });
});
