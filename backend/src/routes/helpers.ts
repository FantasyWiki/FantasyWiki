import { PLAYER_ERRORS } from "../repositories/playerRepository";

/**
 * A session whose player genuinely doesn't exist is a 404; any other failure
 * (a D1 outage, say) is ours and must not be dressed up as a missing player.
 */
export function playerErrorStatus(error: string): 404 | 500 {
  return error === PLAYER_ERRORS.NOT_FOUND ||
    error === PLAYER_ERRORS.ACCOUNT_NOT_FOUND
    ? 404
    : 500;
}
