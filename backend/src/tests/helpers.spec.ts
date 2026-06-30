import { vi, it, expect } from "vitest";
import { success, failure } from "../repositories/result";

vi.mock("../services/player", () => {
  const PlayerService = vi.fn();
  return { PlayerService };
});

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
  (PlayerService as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    getPlayerByGoogleAccountId: mockGet,
  }));

  const result = await resolveCurrentPlayer(makeCtx("google-123"));
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.value).toEqual(player);
  expect(mockGet).toHaveBeenCalledWith("google-123");
});

it("resolveCurrentPlayer propagates failure when player not found", async () => {
  const mockGet = vi.fn().mockResolvedValue(failure("Player not found"));
  (PlayerService as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    getPlayerByGoogleAccountId: mockGet,
  }));

  const result = await resolveCurrentPlayer(makeCtx("google-456"));
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe("Player not found");
});
