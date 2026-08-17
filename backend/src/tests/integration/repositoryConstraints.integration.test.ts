import { describe, it, expect } from "vitest";
import { PLAYER_ERRORS } from "../../repositories/playerRepository";
import { unwrap } from "../../repositories/result";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import { repositories } from "../support/target";

/**
 * The uniqueness rules the store guarantees, stated as behaviour rather than as
 * constraints on columns — so they hold for any implementation and say what a
 * caller can rely on.
 *
 * These replace tests that fed SQLite's constraint text through a fake database:
 * asserting against the real store is stronger, because it keeps working when
 * the driver rewords its errors, and it is the same evidence the MongoDB
 * implementation will have to produce.
 */
describe("repository constraints", () => {
  it("refuses a second player with a username already taken", async () => {
    const players = repositories().players;
    unwrap(
      await players.save({
        username: "taken",
        accountId: "account-first",
        email: "first@example.com",
      }),
      "first player",
    );

    const second = await players.save({
      username: "taken",
      accountId: "account-second",
      email: "second@example.com",
    });

    // LoginService branches on this exact constant to retry with a suffix, so
    // the failure has to be named rather than left as driver prose.
    expect(second).toEqual({ ok: false, error: PLAYER_ERRORS.USERNAME_TAKEN });
  });

  it("refuses a second player on an account that already has one", async () => {
    const players = repositories().players;
    unwrap(
      await players.save({
        username: "firstclaim",
        accountId: "account-shared",
        email: "shared@example.com",
      }),
      "first player",
    );

    const second = await players.save({
      username: "secondclaim",
      accountId: "account-shared",
      email: "shared@example.com",
    });

    expect(second.ok).toBe(false);
  });

  it("refuses a second team for the same player in one league", async () => {
    const { players, teams } = repositories();
    const player = unwrap(
      await players.save({
        username: "twoteams",
        accountId: "account-twoteams",
        email: "twoteams@example.com",
      }),
      "player",
    );
    unwrap(
      await teams.create({
        name: "First FC",
        playerId: player.id,
        leagueId: GLOBAL_LEAGUE_ID,
      }),
      "first team",
    );

    const second = await teams.create({
      name: "Second FC",
      playerId: player.id,
      leagueId: GLOBAL_LEAGUE_ID,
    });

    expect(second.ok).toBe(false);
  });
});
