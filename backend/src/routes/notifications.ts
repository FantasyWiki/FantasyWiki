import { Hono } from "hono";
import { NotificationService } from "../services/notification";
import { NOTIFICATION_ERRORS } from "../repositories/notificationRepository";
import { AppVariables } from "../appEnv";
import { currentPlayer } from "./currentPlayer";

const notifications = new Hono<{ Variables: AppVariables }>();

notifications.patch("/:id/read", currentPlayer, async (c) => {
  const id = c.req.param("id");
  const notificationService = new NotificationService(c.var.repositories);
  const result = await notificationService.markAsRead(id, c.var.player.id);
  if (!result.ok) {
    const status =
      result.error === NOTIFICATION_ERRORS.NOT_FOUND
        ? 404
        : result.error === NOTIFICATION_ERRORS.NOT_AUTHORIZED
          ? 403
          : 500;
    return c.json({ error: result.error }, status);
  }
  return c.json({ success: true });
});

export default notifications;
