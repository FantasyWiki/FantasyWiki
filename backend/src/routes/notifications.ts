import { Hono } from "hono";
import { NotificationService } from "../services/notification";
import { NOTIFICATION_ERRORS } from "../repositories/notificationRepository";
import { resolveCurrentPlayer } from "./helpers";

type Bindings = {
  db: D1Database;
};

const notifications = new Hono<{ Bindings: Bindings }>();

notifications.patch("/:id/read", async (c) => {
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json({ error: playerResult.error }, 404);
  }

  const id = c.req.param("id");
  const notificationService = new NotificationService(c.env.db);
  const result = await notificationService.markAsRead(
    id,
    playerResult.value.id,
  );
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
