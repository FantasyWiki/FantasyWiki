import { Context } from "hono";
import { JWTPayload } from "hono/utils/jwt/types";
import { PlayerService } from "../services/player";
import { PLAYER_ERRORS } from "../repositories/playerRepository";
import { Player } from "../../../model";
import { Result } from "../repositories/result";

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

// Generic over the bindings so routes that need more than `db` (reports needs
// the GitHub credentials and the rate limiter) can still call this: Hono's
// Context is invariant, so a fixed binding type would reject them.
export async function resolveCurrentPlayer<B extends { db: D1Database }>(
  c: Context<{ Bindings: B }>,
  playerService: Pick<
    PlayerService,
    "getPlayerByGoogleAccountId"
  > = new PlayerService(c.env.db),
): Promise<Result<Player>> {
  const payload = c.get("jwtPayload") as JWTPayload;
  return playerService.getPlayerByGoogleAccountId(payload.sub as string);
}
