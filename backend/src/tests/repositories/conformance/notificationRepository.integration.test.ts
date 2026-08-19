import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect } from "vitest";
import { NOTIFICATION_ERRORS } from "../../../repositories/notificationRepository";
import { unwrap } from "../../../repositories/result";
import { GLOBAL_LEAGUE_ID } from "../../../services/league";
import { repositories } from "../../support/target";
import {
  anotherLeague,
  aPlayer,
  aTeamIn,
  unique,
} from "../../support/subjects";

const OPENED = Temporal.Now.plainDateISO();

/** A notification about a contract the given team holds. */
async function notify(teamId: string, message: string): Promise<string> {
  const contract = unwrap(
    await repositories().contracts.create({
      teamId,
      articleId: unique("Article"),
      purchaseDate: OPENED,
      expireDate: OPENED.add({ days: 7 }),
      purchasePrice: 10,
    }),
    "contract",
  );
  const id = unique("notification");
  unwrap(
    await repositories().notifications.create({
      id,
      contractId: contract.id,
      message,
      date: OPENED.toString(),
    }),
    "notification",
  );
  return id;
}

/**
 * What any NotificationRepository owes its callers. A notification hangs off the
 * contract it is about, which is how it reaches a player at all — and why a sold
 * contract's row is retained rather than deleted.
 */
describe("NotificationRepository conformance", () => {
  it("reaches the player through the contract's team", async () => {
    const team = await aTeamIn(GLOBAL_LEAGUE_ID);
    const id = await notify(team.id, "Your contract expired");

    const inbox = unwrap(
      await repositories().notifications.getByPlayerAndLeague(
        team.playerId,
        GLOBAL_LEAGUE_ID,
      ),
      "inbox",
    );

    expect(inbox.map((row) => row.id)).toEqual([id]);
    expect(inbox[0].message).toBe("Your contract expired");
    // Enriched with the contract, team and player it concerns, so a feed can be
    // built without a lookup per row.
    expect(inbox[0].teamId).toBe(team.id);
    expect(inbox[0].leagueId).toBe(GLOBAL_LEAGUE_ID);
    expect(inbox[0].isRead).toBe(false);
  });

  it("keeps one player's notifications out of another's", async () => {
    const team = await aTeamIn(GLOBAL_LEAGUE_ID);
    const other = await aTeamIn(GLOBAL_LEAGUE_ID);
    const mine = await notify(team.id, "Mine");
    await notify(other.id, "Someone else's");

    const inbox = unwrap(
      await repositories().notifications.getByPlayerAndLeague(
        team.playerId,
        GLOBAL_LEAGUE_ID,
      ),
      "inbox",
    );

    expect(inbox.map((row) => row.id)).toEqual([mine]);
  });

  it("scopes the league feed, while the player feed spans leagues", async () => {
    const notifications = repositories().notifications;
    const playerId = await aPlayer();
    const elsewhere = await anotherLeague();
    const home = unwrap(
      await repositories().teams.create({
        name: unique("Home FC"),
        playerId,
        leagueId: GLOBAL_LEAGUE_ID,
      }),
      "home team",
    );
    const away = unwrap(
      await repositories().teams.create({
        name: unique("Away FC"),
        playerId,
        leagueId: elsewhere.id,
      }),
      "away team",
    );
    const atHome = await notify(home.id, "At home");
    const away_ = await notify(away.id, "Away");

    expect(
      unwrap(
        await notifications.getByPlayerAndLeague(playerId, GLOBAL_LEAGUE_ID),
        "league feed",
      ).map((row) => row.id),
    ).toEqual([atHome]);
    expect(
      unwrap(await notifications.getByPlayerId(playerId), "player feed")
        .map((row) => row.id)
        .sort(),
    ).toEqual([atHome, away_].sort());
  });

  it("marks one as read for its owner", async () => {
    const notifications = repositories().notifications;
    const team = await aTeamIn(GLOBAL_LEAGUE_ID);
    const id = await notify(team.id, "Read me");

    unwrap(await notifications.markAsRead(id, team.playerId), "mark as read");

    const inbox = unwrap(
      await notifications.getByPlayerId(team.playerId),
      "inbox",
    );
    expect(inbox.find((row) => row.id === id)?.isRead).toBe(true);
  });

  it("refuses to mark another player's notification, and names why", async () => {
    const notifications = repositories().notifications;
    const team = await aTeamIn(GLOBAL_LEAGUE_ID);
    const other = await aTeamIn(GLOBAL_LEAGUE_ID);
    const id = await notify(other.id, "Not yours");

    // Two distinct answers, because the route turns them into 403 and 404.
    expect(await notifications.markAsRead(id, team.playerId)).toEqual({
      ok: false,
      error: NOTIFICATION_ERRORS.NOT_AUTHORIZED,
    });
    expect(
      await notifications.markAsRead("no-such-notification", team.playerId),
    ).toEqual({ ok: false, error: NOTIFICATION_ERRORS.NOT_FOUND });
  });
});
