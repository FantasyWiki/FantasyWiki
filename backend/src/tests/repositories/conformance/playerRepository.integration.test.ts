import { describe, it, expect } from "vitest";
import { PLAYER_ERRORS } from "../../../repositories/playerRepository";
import { unwrap } from "../../../repositories/result";
import { repositories } from "../../support/target";
import { unique } from "./subjects";

/**
 * What any PlayerRepository owes its callers. D1 keeps these with UNIQUE
 * columns, but nothing here says so — an implementation may enforce them
 * however its store allows, as long as callers see these answers.
 */
describe("PlayerRepository conformance", () => {
  it("refuses a username already taken, naming the recoverable failure", async () => {
    const players = repositories().players;
    unwrap(
      await players.save({
        username: "taken",
        accountId: unique("account"),
        email: "first@example.com",
      }),
      "first player",
    );

    const second = await players.save({
      username: "taken",
      accountId: unique("account"),
      email: "second@example.com",
    });

    // LoginService branches on this exact constant to retry with a suffix, so
    // it has to be named rather than left as whatever the store said.
    expect(second).toEqual({ ok: false, error: PLAYER_ERRORS.USERNAME_TAKEN });
  });

  it("refuses a second player on an account that already has one", async () => {
    const players = repositories().players;
    const accountId = unique("account");
    unwrap(
      await players.save({
        username: unique("first"),
        accountId,
        email: "shared@example.com",
      }),
      "first player",
    );

    const second = await players.save({
      username: unique("second"),
      accountId,
      email: "shared@example.com",
    });

    expect(second.ok).toBe(false);
  });

  it("finds a saved player by id and by account", async () => {
    const players = repositories().players;
    const username = unique("findable");
    const accountId = unique("account");
    const saved = unwrap(
      await players.save({
        username,
        accountId,
        email: "findable@example.com",
      }),
      "player",
    );

    expect(unwrap(await players.getById(saved.id), "by id")).toEqual({
      id: saved.id,
      username,
    });
    expect(
      unwrap(await players.getPlayerByAccountId(accountId), "by account"),
    ).toEqual({ id: saved.id, username });
  });

  it("names a miss so callers can tell it from a broken read", async () => {
    const players = repositories().players;

    expect(await players.getById("no-such-player")).toEqual({
      ok: false,
      error: PLAYER_ERRORS.NOT_FOUND,
    });
    // A first-time login is this, not an error — LoginService turns it into a
    // player rather than a failure.
    expect(await players.getPlayerByAccountId("no-such-account")).toEqual({
      ok: false,
      error: PLAYER_ERRORS.ACCOUNT_NOT_FOUND,
    });
  });
});
