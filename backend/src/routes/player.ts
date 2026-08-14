import { Hono } from "hono";
import { NotificationService } from "../services/notification";
import { PlayerDTO } from "../../../dto/playerDTO";
import { AuthedVariables } from "../appEnv";
import { currentPlayer } from "./currentPlayer";

const player = new Hono<{ Variables: AuthedVariables }>();

player.get("/", currentPlayer, async (c) => {
  const dto: PlayerDTO = {
    id: c.var.player.id,
    name: c.var.player.username,
  };
  return c.json(dto);
});

player.get("/notifications", currentPlayer, async (c) => {
  const notificationService = new NotificationService(c.var.repositories);
  const result = await notificationService.getAllForPlayer(c.var.player.id);
  if (!result.ok) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.value);
});

export default player;
