import { it, expect, vi } from "vitest";
import { success, failure } from "../repositories/result";
import { resolveCurrentPlayer } from "../routes/helpers";
import { PlayerService } from "../services/player";

function makeCtx(sub: string) {
  return {
    get: (key: string) => (key === "jwtPayload" ? { sub } : undefined),
    env: { db: {} as D1Database },
  } as Parameters<typeof resolveCurrentPlayer>[0];
}

it("resolveCurrentPlayer returns the player on success", async () => {
  const player = { id: "p-1", username: "user" };
  const mockGet = vi.fn().mockResolvedValue(success(player));
  const fakePlayerService = {
    getPlayerByGoogleAccountId: mockGet,
  } as unknown as PlayerService;

  const result = await resolveCurrentPlayer(
    makeCtx("google-123"),
    fakePlayerService,
  );
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.value).toEqual(player);
  expect(mockGet).toHaveBeenCalledWith("google-123");
});

it("resolveCurrentPlayer propagates failure when player not found", async () => {
  const mockGet = vi.fn().mockResolvedValue(failure("Player not found"));
  const fakePlayerService = {
    getPlayerByGoogleAccountId: mockGet,
  } as unknown as PlayerService;

  const result = await resolveCurrentPlayer(
    makeCtx("google-456"),
    fakePlayerService,
  );
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe("Player not found");
});
