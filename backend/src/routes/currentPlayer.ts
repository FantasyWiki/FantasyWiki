import { createMiddleware } from "hono/factory";
import { JWTPayload } from "hono/utils/jwt/types";
import { AuthedVariables } from "../appEnv";
import { PlayerService } from "../services/player";
import { playerErrorStatus } from "./helpers";

/**
 * Resolves the caller's player from the session and puts it on the context, so
 * a handler that needs to know who is asking reads `c.var.player` instead of
 * repeating the lookup and the same 404/500 mapping. Identity comes from the
 * JWT subject and never from the request, which is what lets the self-scoped
 * endpoints keep `playerId` out of their URLs entirely
 * (docs/development/api-naming-rules.md).
 *
 * Opted into per route rather than mounted across `/api/*`: the league, market
 * and leaderboard reads are deliberately not membership-scoped, and would
 * otherwise start 404ing for a session whose player does not exist yet.
 */
export const currentPlayer = createMiddleware<{
  Variables: AuthedVariables;
}>(async (c, next) => {
  const payload = c.get("jwtPayload") as JWTPayload;
  const result = await new PlayerService(
    c.var.repositories,
  ).getPlayerByGoogleAccountId(payload.sub as string);

  if (!result.ok) {
    return c.json({ error: result.error }, playerErrorStatus(result.error));
  }

  c.set("player", result.value);
  await next();
});
