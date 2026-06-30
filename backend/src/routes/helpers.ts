import { Context } from "hono";
import { JWTPayload } from "hono/utils/jwt/types";
import { PlayerService } from "../services/player";
import { Player } from "../../../model";
import { Result } from "../repositories/result";

type Bindings = { db: D1Database };

export async function resolveCurrentPlayer(
  c: Context<{ Bindings: Bindings }>,
): Promise<Result<Player>> {
  const payload = c.get("jwtPayload") as JWTPayload;
  const playerService = new PlayerService(c.env.db);
  return playerService.getPlayerByGoogleAccountId(payload.sub as string);
}
