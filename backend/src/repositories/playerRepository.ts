import { League, Player } from "../../../model";
import { Result } from "./result";

export const PLAYER_ERRORS = {
  /** No player row for the requested id. */
  NOT_FOUND: "Player not found",
  /**
   * No player is linked to this Google account yet — i.e. a first-time login,
   * which LoginService turns into an account creation rather than an error.
   */
  ACCOUNT_NOT_FOUND: "No player found for this account",
  /**
   * `save` lost the username uniqueness constraint. The username is the only
   * thing the caller can vary, so this is the signal to retry with another one.
   */
  USERNAME_TAKEN: "Username already taken",
} as const;

export interface PlayerRepository {
  /**
   * Creates the player (and its Google account, if new). Fails with
   * PLAYER_ERRORS.USERNAME_TAKEN when the username is already in use — the
   * only failure a caller can recover from, by retrying with another username.
   */
  save(player: {
    username: string;
    accountId: string;
    email: string;
  }): Promise<Result<Player>>;
  getById(id: string): Promise<Result<Player>>;
  getLeaguesByPlayerId(id: string): Promise<Result<League[]>>;
  getPlayerByAccountId(accountId: string): Promise<Result<Player>>;
}
