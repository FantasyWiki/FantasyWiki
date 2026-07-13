import { describe, it, expect } from "vitest";
import { leaguesApi } from "@/services/api";

/**
 * End-to-end (service → MSW handler) coverage for the renewal-election flow.
 * In the mock data the current player (player-1) owns team-1 in the "italy"
 * league, which holds ctr-13; team-6 (not the player's) holds ctr-16 in "global".
 */
describe("leaguesApi.renewMyContract (MSW)", () => {
  it("elects renewal on an owned contract and returns it with renewalElected set", async () => {
    const contract = await leaguesApi.renewMyContract("italy", "ctr-13");
    expect(contract.id).toBe("ctr-13");
    expect(contract.renewalElected).toBe(true);
  });

  it("rejects renewing a contract owned by another team", async () => {
    await expect(
      leaguesApi.renewMyContract("global", "ctr-16")
    ).rejects.toThrow(/do not own/i);
  });
});
