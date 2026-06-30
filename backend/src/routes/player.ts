import { Hono } from "hono";
import { NotificationService } from "../services/notification";
import { PlayerDTO } from "../../../dto/playerDTO";
import { resolveCurrentPlayer } from "./helpers";

type Bindings = {
  db: D1Database;
};

const player = new Hono<{ Bindings: Bindings }>();

player.get("/", async (c) => {
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json({ error: playerResult.error }, 404);
  }

  const dto: PlayerDTO = {
    id: playerResult.value.id,
    name: playerResult.value.username,
  };
  return c.json(dto);
});

player.get("/notifications", async (c) => {
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json({ error: playerResult.error }, 404);
  }

  const notificationService = new NotificationService(c.env.db);
  const result = await notificationService.getAllForPlayer(
    playerResult.value.id,
  );
  if (!result.ok) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.value);
});

export default player;
