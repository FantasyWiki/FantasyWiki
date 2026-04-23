import { Hono } from "hono";
import { PlayerService } from "../services/player";

type Bindings = {
  db: D1Database;
};

const players = new Hono<{ Bindings: Bindings }>();

// Create a new player
players.post("/", async (c) => {
  const { username, email, accountId } = await c.req.json<{
    username: string;
    email: string;
    accountId: string;
  }>();

  if (!username || !email || !accountId) {
    return c.json({ error: "Username, email and accountId are required" }, 400);
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
  const result = await service.getPlayerById(id);

  if (result.ok) {
    return c.json(result.value);
  }

  return c.json({ error: result.error as string }, 404);
});

// Get player by Google account ID
players.get("/account/:accountId", async (c) => {
  const accountId = c.req.param("accountId");
  const service = new PlayerService(c.env.db);
  const result = await service.getPlayerByGoogleAccountId(accountId);

  if (result.ok) {
    return c.json(result.value);
  }

  return c.json({ error: result.error as string }, 404);
});

export default players;
