import { Hono } from "hono";
import { describe, it, expect, vi } from "vitest";
import { AuthedVariables } from "../../appEnv";
import { PLAYER_ERRORS } from "../../repositories/playerRepository";
import { Repositories } from "../../repositories/repositories";
import { success, failure } from "../../repositories/result";
import { currentPlayer } from "../../routes/currentPlayer";

const player = { id: "p-1", username: "user" };

/**
 * A whole app rather than a fake context: the middleware's contract is what a
 * handler behind it sees and what the caller gets when it refuses, and both are
 * properties of the pipeline.
 */
function appWith(getPlayerByAccountId: ReturnType<typeof vi.fn>) {
  const app = new Hono<{ Variables: AuthedVariables }>();

  app.use("*", async (c, next) => {
    c.set("jwtPayload", { sub: "google-123" });
    c.set("repositories", {
      players: { getPlayerByAccountId },
    } as unknown as Repositories);
    return next();
  });

  app.get("/", currentPlayer, (c) => c.json({ seen: c.var.player }));
  return app;
}

describe("currentPlayer", () => {
  it("puts the session's player on the context", async () => {
    const lookup = vi.fn().mockResolvedValue(success(player));

    const response = await appWith(lookup).request("/");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ seen: player });
    // Identity comes from the JWT subject, never from the request.
    expect(lookup).toHaveBeenCalledWith("google-123");
  });

  it("answers 404 without running the handler when no player matches", async () => {
    const lookup = vi.fn().mockResolvedValue(failure(PLAYER_ERRORS.NOT_FOUND));

    const response = await appWith(lookup).request("/");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: PLAYER_ERRORS.NOT_FOUND });
  });

  it("answers 500 when the lookup itself failed", async () => {
    const lookup = vi
      .fn()
      .mockResolvedValue(failure("Error retrieving player: D1_ERROR"));

    const response = await appWith(lookup).request("/");

    expect(response.status).toBe(500);
  });
});
