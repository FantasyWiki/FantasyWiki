import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect } from "vitest";
import { TEAM_ERRORS } from "../../../repositories/teamRepository";
import { unwrap } from "../../../repositories/result";
import { GLOBAL_LEAGUE_ID } from "../../../services/league";
import { repositories } from "../../support/target";
import {
  anotherLeague,
  aPlayer,
  aTeamIn,
  unique,
} from "../../support/subjects";
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

/**
 * The lifecycle conditions that ride in the join and the departure.
 *
 * Both are guarded writes, and the guarantee is the same shape in each: the
 * conditions are decided *inside* the write, so a caller who reaches the
 * repository directly — the shape of a concurrent request whose pre-check has
 * gone stale — gets the same refusal as one who asked politely. D1 has no
 * interactive transactions and this is the only atomicity it has; another target
 * may keep them however it can, so long as these are the answers.
 */
describe("the join gate's lifecycle conditions", () => {
  it("refuses a closed league", async () => {
    const league = await anotherLeague();
    unwrap(
      await repositories().leagues.close(
        league.id,
        league.adminId,
        Temporal.Now.instant(),
      ),
      "closure",
    );

    const result = await repositories().teams.create({
      name: unique("Too Late FC"),
      playerId: await aPlayer(),
      leagueId: league.id,
    });

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.JOIN_CONFLICT });
  });

  it("refuses a player who left, so leaving is final", async () => {
    // What makes a departure a record rather than a toggle: the row they left is
    // the only one they will ever have here, so the gate has to see it even
    // though every "current member" read cannot.
    const league = await anotherLeague();
    const team = await aTeamIn(league.id);
    unwrap(
      await repositories().teams.leave({
        teamId: team.id,
        playerId: team.playerId,
        leagueId: league.id,
        leftAt: Temporal.Now.instant(),
      }),
      "departure",
    );

    const result = await repositories().teams.create({
      name: unique("Comeback FC"),
      playerId: team.playerId,
      leagueId: league.id,
    });

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.JOIN_CONFLICT });
  });

  it("still admits a newcomer to an open league", async () => {
    // The guard has to refuse the cases above without refusing the ordinary one.
    const league = await anotherLeague();

    const result = await repositories().teams.create({
      name: unique("Fresh XI"),
      playerId: await aPlayer(),
      leagueId: league.id,
    });

    expect(result.ok).toBe(true);
  });
});

describe("leave", () => {
  async function leftAt(playerId: string, leagueId: string) {
    const membership = unwrap(
      await repositories().teams.getMembership(playerId, leagueId),
      "membership",
    );
    return membership?.leftAt ?? null;
  }

  /** A league with a member and a bystander, so a departure is never the last. */
  async function aLeagueWithTwoMembers() {
    const league = await anotherLeague();
    const member = await aTeamIn(league.id);
    return { league, member };
  }

  it("stamps the departure on the leaving player's team", async () => {
    const { league, member } = await aLeagueWithTwoMembers();
    const at = Temporal.Instant.from("2026-08-12T12:00:00Z");

    const result = await repositories().teams.leave({
      teamId: member.id,
      playerId: member.playerId,
      leagueId: league.id,
      leftAt: at,
    });

    expect(result).toEqual({ ok: true, value: { leagueDeleted: false } });
    expect((await leftAt(member.playerId, league.id))?.toString()).toBe(
      at.toString(),
    );
  });

  it("refuses a second departure and keeps the first moment", async () => {
    const { league, member } = await aLeagueWithTwoMembers();
    const first = Temporal.Instant.from("2026-08-01T00:00:00Z");
    const departure = {
      teamId: member.id,
      playerId: member.playerId,
      leagueId: league.id,
    };
    unwrap(
      await repositories().teams.leave({ ...departure, leftAt: first }),
      "departure",
    );

    const result = await repositories().teams.leave({
      ...departure,
      leftAt: Temporal.Instant.from("2026-08-05T00:00:00Z"),
    });

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAVE_CONFLICT });
    expect((await leftAt(member.playerId, league.id))?.toString()).toBe(
      first.toString(),
    );
  });

  it("lets the league's own admin out, and passes the league on", async () => {
    // The founding team is the senior one, so the member who joined next
    // inherits. A league whose admin walked out could never be closed by anyone.
    const { league, member } = await aLeagueWithTwoMembers();
    const founding = unwrap(
      await repositories().teams.getByPlayerAndLeague(
        league.adminId,
        league.id,
      ),
      "founding team",
    );

    const result = await repositories().teams.leave({
      teamId: founding!.id,
      playerId: league.adminId,
      leagueId: league.id,
      leftAt: Temporal.Now.instant(),
    });

    expect(result).toEqual({ ok: true, value: { leagueDeleted: false } });
    const after = unwrap(
      await repositories().leagues.getById(league.id),
      "league",
    );
    expect(after.adminId).toBe(member.playerId);
  });

  it("refuses the Global League", async () => {
    // Leaving it would strand the player: first run routes anyone without a
    // Global League team to create one, and the join gate would then refuse.
    const team = await aTeamIn(GLOBAL_LEAGUE_ID);

    const result = await repositories().teams.leave({
      teamId: team.id,
      playerId: team.playerId,
      leagueId: GLOBAL_LEAGUE_ID,
      leftAt: Temporal.Now.instant(),
    });

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAVE_CONFLICT });
    expect(await leftAt(team.playerId, GLOBAL_LEAGUE_ID)).toBeNull();
  });

  it("refuses a league closed in the meantime", async () => {
    // The race the guard exists for: the admin's close landed between this
    // player's pre-check and their write.
    const { league, member } = await aLeagueWithTwoMembers();
    unwrap(
      await repositories().leagues.close(
        league.id,
        league.adminId,
        Temporal.Now.instant(),
      ),
      "closure",
    );

    const result = await repositories().teams.leave({
      teamId: member.id,
      playerId: member.playerId,
      leagueId: league.id,
      leftAt: Temporal.Now.instant(),
    });

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAVE_CONFLICT });
    expect(await leftAt(member.playerId, league.id)).toBeNull();
  });

  it("refuses a player who has no team in the league", async () => {
    const league = await anotherLeague();

    const result = await repositories().teams.leave({
      teamId: "no-such-team",
      playerId: await aPlayer(),
      leagueId: league.id,
      leftAt: Temporal.Now.instant(),
    });

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAVE_CONFLICT });
  });
});
