import { beforeEach, describe, expect, it } from "vitest";
import { PASSWORD_ERRORS } from "../../../auth/password/credentialRepository";
import { unwrap } from "../../../repositories/result";
import { aPlayer, unique } from "../../support/subjects";
import { credentials, repositories, store } from "../../support/target";

/**
 * The promises {@link CredentialRepository} makes. Not part of the conformance
 * suite, because there is exactly one implementation and there cannot be a
 * second while `players.accountId` is a foreign key onto `google_accounts`
 * (docs/architecture/auth-modes.md).
 */
describe("credential repository", () => {
  beforeEach(async () => {
    await store().reset();
  });

  it("creates a player the rest of the app can find by account", async () => {
    const username = unique("registrant");

    const { player, accountId } = unwrap(
      await credentials().register(username, "hash"),
      "registration",
    );
    expect(player.username).toBe(username);

    const found = unwrap(
      await repositories().players.getPlayerByAccountId(accountId),
      "player by account",
    );
    expect(found).toEqual(player);
  });

  it("mints an account id no Google subject could collide with", async () => {
    const username = unique("registrant");
    await credentials().register(username, "hash");

    const { accountId } = unwrap(
      await credentials().findCredentials(username),
      "credentials",
    );

    // Google subjects are numeric strings; this is deliberately not one.
    expect(accountId).toMatch(/^pwd_/);
    expect(Number.isNaN(Number(accountId))).toBe(true);
  });

  it("gives back the hash it was handed, and nothing else", async () => {
    const username = unique("registrant");
    await credentials().register(username, "the-stored-record");

    expect(
      unwrap(await credentials().findCredentials(username), "credentials")
        .passwordHash,
    ).toBe("the-stored-record");
  });

  it("refuses a username another credential already holds", async () => {
    const username = unique("registrant");
    await credentials().register(username, "hash");

    const again = await credentials().register(username, "other-hash");

    expect(again).toEqual({
      ok: false,
      error: PASSWORD_ERRORS.USERNAME_TAKEN,
    });
  });

  /**
   * The two account kinds share one username space, because they share the
   * `players` table that `players.username` is unique on.
   */
  it("refuses a username a Google player already holds", async () => {
    const taken = unique("player");
    unwrap(
      await repositories().players.save({
        username: taken,
        accountId: unique("account"),
        email: `${taken}@example.com`,
      }),
      "google player",
    );

    expect(await credentials().register(taken, "hash")).toEqual({
      ok: false,
      error: PASSWORD_ERRORS.USERNAME_TAKEN,
    });
  });

  /**
   * Both writes or neither. A player with no credential could never sign in
   * again and there is no way to remove one — `PlayerRepository` has no delete.
   */
  it("leaves no player behind when the username is taken", async () => {
    const taken = unique("player");
    unwrap(
      await repositories().players.save({
        username: taken,
        accountId: unique("account"),
        email: `${taken}@example.com`,
      }),
      "google player",
    );

    await credentials().register(taken, "hash");

    // The credential write goes first, so a rolled-back transaction is the only
    // thing standing between this and an orphaned reservation.
    expect(await credentials().findCredentials(taken)).toEqual({
      ok: false,
      error: PASSWORD_ERRORS.INVALID_CREDENTIALS,
    });
  });

  it("reports an unknown username as it reports a wrong password", async () => {
    expect(await credentials().findCredentials(unique("nobody"))).toEqual({
      ok: false,
      error: PASSWORD_ERRORS.INVALID_CREDENTIALS,
    });
  });

  it("keeps password accounts out of the Google account space", async () => {
    const googlePlayer = await aPlayer();
    const username = unique("registrant");
    const registered = unwrap(
      await credentials().register(username, "hash"),
      "registration",
    );

    expect(registered.player.id).not.toBe(googlePlayer);
  });
});
