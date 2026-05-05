import { Hono } from "hono";
import { JWTPayload } from "hono/utils/jwt/types";
import { PlayerService } from "../services/player";

type Bindings = {
  db: D1Database;
};

const players = new Hono<{ Bindings: Bindings }>();

// Create a new player
players.post("/", async (c) => {
  const { username } = await c.req.json<{
    username: string;
  }>();

  if (!username) {
    return c.json({ error: "Username is required" }, 400);
  }

  const payload: JWTPayload = c.get("jwtPayload") as JWTPayload;
  const accountId = payload.sub;
  const email = payload.email;
  if (!accountId || !email || typeof email !== "string") {
    return c.json({ error: "Invalid authenticated session" }, 401);
  }

  const service = new PlayerService(c.env.db);
  const result = await service.createPlayer(username, email, accountId);

  if (result.ok) {
    return c.json(result.value, 201);
  }

  return c.json({ error: result.error as string }, 500);
});

// Get player by ID
players.get("/:id", async (c) => {
  const id = c.req.param("id");
  const service = new PlayerService(c.env.db);
  const payload: JWTPayload = c.get("jwtPayload") as JWTPayload;
  const currentPlayer = await service.getPlayerByGoogleAccountId(
    payload.sub as string,
  );
  if (!currentPlayer.ok) {
    return c.json({ error: currentPlayer.error as string }, 404);
  }
  if (currentPlayer.value.id !== id) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const result = await service.getPlayerById(id);

  if (result.ok) {
    return c.json(result.value);
  }

  return c.json({ error: result.error as string }, 404);
});

// Get player by Google account ID
players.get("/account/:accountId", async (c) => {
  const accountId = c.req.param("accountId");
  const payload: JWTPayload = c.get("jwtPayload") as JWTPayload;
  if (payload.sub !== accountId) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const service = new PlayerService(c.env.db);
  const result = await service.getPlayerByGoogleAccountId(accountId);

  if (result.ok) {
    return c.json(result.value);
  }

  return c.json({ error: result.error as string }, 404);
});

export default players;
