import { Temporal } from "@js-temporal/polyfill";
import { LeagueInvitePolicy, LeagueVisibility } from "../../../../model/enums";
import { REFERENCE_SCALE } from "../../../../model/languageScale";
import { NewLeague } from "../../repositories/leagueRepository";
import { unwrap } from "../../repositories/result";
import { repositories } from "./target";
import type { League, Team } from "../../../../model";

/**
 * The subjects a test needs before it can say anything: a contract needs a
 * team, a team needs a league and a player. Built through the repository
 * interfaces rather than the services — a service could satisfy a test its
 * repository does not, and a suite that seeds through services cannot then be
 * used to judge a second repository implementation.
 *
 * Nothing here defaults anything. What a league is called, which edition it
 * plays and whether it is private are the very things these tests are about, so
 * a helper that filled them in would be deciding the fixture on the test's
 * behalf — and a test would then pass or fail on a value it never named. The
 * only values invented here are the ones that merely have to be *distinct*.
 */

let sequence = 0;

/** Keeps names and ids apart within a test, since several must be unique. */
export function unique(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export async function aPlayer(): Promise<string> {
  const handle = unique("player");
  return unwrap(
    await repositories().players.save({
      username: handle,
      accountId: unique("account"),
      email: `${handle}@example.com`,
    }),
    "player",
  ).id;
}

/**
 * A league and the team its founder plays it with, written the way production
 * writes them — `NewLeague` whole, so a test says everything the real caller
 * says and nothing is chosen for it.
 *
 * There is no id to pass: `createWithFoundingTeam` mints one, so a test
 * addresses the league by what it gets back. That is the point of going through
 * the production path — a league seeded around it could hold a shape the real
 * write can never produce, and the suite would then pass on a state no player
 * can reach.
 */
export async function aLeague(
  league: NewLeague,
  foundingTeamName: string,
): Promise<{ league: League; team: Team }> {
  return unwrap(
    await repositories().leagues.createWithFoundingTeam(
      league,
      foundingTeamName,
    ),
    "league",
  );
}

/**
 * Another league, with nothing distinctive about it.
 *
 * For the tests whose only requirement is that it is *not* the league under
 * test — cross-league isolation, mostly. It takes no arguments precisely
 * because such a test has no requirements to state: every property of this
 * league is arbitrary, and one that depends on any of them builds its own with
 * {@link aLeague}.
 */
export async function anotherLeague(): Promise<League> {
  const name = unique("Another League");
  return (
    await aLeague(
      {
        name,
        adminId: await aPlayer(),
        startDate: Temporal.Instant.from("2024-01-01T00:00:00Z"),
        endDate: Temporal.Instant.from("2124-01-01T00:00:00Z"),
        domain: "en",
        languageScale: REFERENCE_SCALE,
        icon: "🌍",
        visibility: LeagueVisibility.PUBLIC,
        invitePolicy: LeagueInvitePolicy.MEMBERS,
        invitationCode: null,
      },
      unique("Founders"),
    )
  ).league;
}

/**
 * The whole team: its callers need the player it belongs to as well as its id.
 *
 * The player and the name are invented because this is the helper for a team
 * whose only relevant property is which league it is in. A test that cares who
 * owns the team, or what it is called, calls `teams.create` and says so.
 */
export async function aTeamIn(leagueId: string): Promise<Team> {
  return unwrap(
    await repositories().teams.create({
      name: unique("Team"),
      playerId: await aPlayer(),
      leagueId,
    }),
    "team",
  );
}

/** A team's balance, read the direct way — a team with no contracts has one too. */
export async function creditsOf(team: Team): Promise<number | undefined> {
  const found = unwrap(
    await repositories().teams.getByPlayerAndLeague(
      team.playerId,
      team.leagueId,
    ),
    "team lookup",
  );
  return found?.credits;
}
