import { describe, it, expect } from "vitest";
import { LeagueRepositoryD1 } from "../../../repositories/d1/leagueRepositoryD1";
import { TeamRepositoryD1 } from "../../../repositories/d1/teamRepositoryD1";

/**
 * What the D1 repositories do when D1 itself is unavailable: return a failure
 * carrying the driver's message, rather than throwing through the service layer.
 *
 * D1-tier rather than conformance, and not because of the SQL — because the
 * fault being simulated is one only this target can have. "The database threw"
 * is not a rule a MongoDB implementation could be asked to reproduce; what a
 * caller is owed is a `Result`, and that is already established everywhere the
 * repositories are exercised for real.
 */

const throwingDb = {
  prepare: () => {
    throw new Error("D1 unavailable");
  },
} as unknown as D1Database;

describe("LeagueRepositoryD1", () => {
  it("returns a failure when the underlying query throws", async () => {
    const result = await new LeagueRepositoryD1(throwingDb).getById("global");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("D1 unavailable");
    }
  });

  it("does not query at all for an empty id list", async () => {
    // An empty `IN ()` is a SQLite syntax error, so the short-circuit is load
    // bearing, not an optimisation — and a throwing db is the only way to prove
    // the query was never built. The answer itself is pinned in the conformance
    // suite, which cannot see whether anything was asked.
    const result = await new LeagueRepositoryD1(throwingDb).countTeamsByLeague(
      [],
    );

    expect(result.ok).toBe(true);
  });
});

describe("TeamRepositoryD1", () => {
  it("returns a failure from create when D1 throws", async () => {
    const result = await new TeamRepositoryD1(throwingDb).create({
      name: "Test",
      playerId: "p1",
      leagueId: "l1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("D1 unavailable");
    }
  });

  it("returns a failure from existsByNameInLeague when D1 throws", async () => {
    const result = await new TeamRepositoryD1(throwingDb).existsByNameInLeague(
      "Test",
      "l1",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("D1 unavailable");
    }
  });

  it("returns a failure from getByPlayerAndLeague when D1 throws", async () => {
    const result = await new TeamRepositoryD1(throwingDb).getByPlayerAndLeague(
      "p1",
      "l1",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("D1 unavailable");
    }
  });

  it("returns a failure from getByIdAndLeague when D1 throws", async () => {
    const result = await new TeamRepositoryD1(throwingDb).getByIdAndLeague(
      "t1",
      "l1",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("D1 unavailable");
    }
  });
});
