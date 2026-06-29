import { describe, it, expect } from "vitest";
import { PlayerRepositoryD1 } from "../../repositories/d1/playerRepositoryD1";
import { TeamRepositoryD1 } from "../../repositories/d1/teamRepositoryD1";

// A D1Database whose every statement build throws, used to exercise the
// repositories' catch branches without depending on a specific SQL failure.
const throwingDb = {
  prepare: () => {
    throw new Error("D1 unavailable");
  },
} as unknown as D1Database;

describe("PlayerRepositoryD1 error handling", () => {
  const repository = new PlayerRepositoryD1(throwingDb);

  it("returns a failure when save throws", async () => {
    const result = await repository.save({
      username: "user",
      accountId: "account",
      email: "user@example.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Error saving player");
      expect(result.error).toContain("D1 unavailable");
    }
  });

  it("returns a failure when getById throws", async () => {
    const result = await repository.getById("some-id");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Error retrieving player");
    }
  });

  it("returns a failure when getLeaguesByPlayerId throws", async () => {
    const result = await repository.getLeaguesByPlayerId("some-id");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Error retrieving leagues");
    }
  });

  it("returns a failure when getPlayerByAccountId throws", async () => {
    const result = await repository.getPlayerByAccountId("some-account");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Error retrieving player");
    }
  });
});

describe("TeamRepositoryD1 error handling", () => {
  const repository = new TeamRepositoryD1(throwingDb);

  it("returns a failure when create throws", async () => {
    const result = await repository.create({
      name: "The Wizards",
      playerId: "player-1",
      leagueId: "league-1",
      credits: 1000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Error creating team");
    }
  });

  it("returns a failure when existsByNameInLeague throws", async () => {
    const result = await repository.existsByNameInLeague(
      "The Wizards",
      "league-1",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Error checking team name");
    }
  });
});
