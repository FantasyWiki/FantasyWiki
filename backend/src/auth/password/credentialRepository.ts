import { Player } from "../../../../model";
import { Result } from "../../repositories/result";

export const PASSWORD_ERRORS = {
  /**
   * The one answer both "no such username" and "wrong password" get. Telling
   * them apart is how a login form becomes a way to find out who has an
   * account, so the two failures are indistinguishable here and in the route
   * (docs/architecture/backend-error-constants.md).
   */
  INVALID_CREDENTIALS: "Invalid username or password",
  /**
   * `register` lost the username uniqueness constraint. Unlike the Google flow,
   * which retries under another name, this is reported: the caller chose the
   * name and is the only one who can choose another.
   */
  USERNAME_TAKEN: "Username already taken",
} as const;

/** What a stored credential says, minus the username it was found by. */
export interface Credentials {
  /** The JWT subject a session for this account is minted with. */
  accountId: string;
  /** Self-describing, in the format `hash.ts` writes and parses. */
  passwordHash: string;
}

/**
 * What `register` created. The account id comes back with the player because a
 * session is minted from it immediately — having the caller read it back would
 * be a second query, and on Mongo a second store and so a second connection in
 * one request, which is the thing the composition is careful not to do.
 */
export interface RegisteredAccount {
  player: Player;
  accountId: string;
}

/**
 * Username/password accounts. A contract of its own rather than a method on
 * `PlayerRepository`, and composed only by `src/indexPassword.ts`, because the
 * deployed Worker must not contain any of this
 * (docs/architecture/auth-modes.md).
 *
 * D1 could not implement it even if it wanted to: `players.accountId` is a
 * foreign key onto `google_accounts` (migration 0001), so an account that is
 * not a Google one has nowhere to point.
 */
export interface CredentialRepository {
  /**
   * Creates the credential and the player it belongs to, as one write.
   *
   * Both or neither: a player with no credential could never be signed in
   * again, and a credential with no player would sign in to nothing — and there
   * is no way back from either, `PlayerRepository` having no delete. Fails with
   * PASSWORD_ERRORS.USERNAME_TAKEN when the name is spoken for, whether by
   * another credential or by a Google player.
   */
  register(
    username: string,
    passwordHash: string,
  ): Promise<Result<RegisteredAccount>>;
  /**
   * The credential stored under this username, or
   * PASSWORD_ERRORS.INVALID_CREDENTIALS when there is none — the same error a
   * bad password gets, so a caller cannot tell the two apart by accident.
   */
  findCredentials(username: string): Promise<Result<Credentials>>;
}
