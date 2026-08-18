import { unwrap } from "../../../repositories/result";
import { repositories } from "../../support/target";
import type { Team } from "../../../../../model";

/**
 * The subjects every conformance suite needs before it can say anything: a
 * contract needs a team, and a team needs a player. Built through the
 * repository interfaces rather than the services — a service could satisfy a
 * test its repository does not.
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

/** The whole team: its callers need the player it belongs to as well as its id. */
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
