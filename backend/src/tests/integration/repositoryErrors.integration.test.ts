import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect } from "vitest";
import { PlayerRepositoryD1 } from "../../repositories/d1/playerRepositoryD1";
import { TeamRepositoryD1 } from "../../repositories/d1/teamRepositoryD1";
import { ContractRepositoryD1 } from "../../repositories/d1/contractRepositoryD1";
import { PLAYER_ERRORS } from "../../repositories/playerRepository";

// A D1Database whose every statement build throws, used to exercise the
// repositories' catch branches without depending on a specific SQL failure.
const throwingDb = {
  prepare: () => {
    throw new Error("D1 unavailable");
  },
} as unknown as D1Database;

/**
 * Not everything thrown is an `Error`: a rejected D1 promise can carry a bare
 * string. The repositories narrow with `instanceof Error` before reading
 * `.message`, and this database exercises the other arm — the fallback text
 * has to stay readable rather than interpolating `undefined` into the failure.
 */
const throwingNonErrorDb = {
  prepare: () => {
    throw "connection reset";
  },
} as unknown as D1Database;

/**
 * D1 reports a rejected write two different ways: as a thrown error (covered by
 * `throwingDb`) and as a resolved `run()` carrying `success: false`. The second
 * is the quiet one — nothing throws, so a repository that only wrapped its SQL
 * in try/catch would read the result as a successful no-op write. This database
 * reproduces exactly that, so the tests can pin the typed failure each write
 * must return instead.
 */
function failingRunDb(error?: string): D1Database {
  const statement = {
    bind: () => statement,
    run: async () => ({
      success: false,
      meta: { changes: 0 },
      ...(error ? { error } : {}),
    }),
  };
  return { prepare: () => statement } as unknown as D1Database;
}

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

/**
 * A failed `run()` that D1 reports rather than throws must not be mistaken for
 * "the row already looked like that". Each write below distinguishes the two:
 * `success: false` is a failure, whereas `changes: 0` on a successful run is a
 * legitimate no-op (the guard lost a race) and is asserted elsewhere.
 */
describe("PlayerRepositoryD1 failed-write handling", () => {
  const player = {
    username: "user",
    accountId: "account",
    email: "user@example.com",
  };

  it("reports the driver's message when the google_accounts insert fails", async () => {
    const repository = new PlayerRepositoryD1(failingRunDb("disk I/O error"));

    const result = await repository.save(player);

    expect(result).toEqual({
      ok: false,
      error: "Failed to save google account: disk I/O error",
    });
  });

  it("falls back to a generic message when the driver gives none", async () => {
    const repository = new PlayerRepositoryD1(failingRunDb());

    const result = await repository.save(player);

    expect(result).toEqual({
      ok: false,
      error: "Failed to save google account: Unknown D1 error",
    });
  });

  it("maps a lost username race to USERNAME_TAKEN when it surfaces as a failed run", async () => {
    // The google_accounts insert succeeds, the players insert comes back
    // failed (not thrown) carrying SQLite's uniqueness text: the caller must
    // still get the typed USERNAME_TAKEN, not raw driver prose.
    let inserts = 0;
    const statement = {
      bind: () => statement,
      run: async () => {
        inserts++;
        return inserts === 1
          ? { success: true, meta: { changes: 1 } }
          : {
              success: false,
              meta: { changes: 0 },
              error: "UNIQUE constraint failed: players.username",
            };
      },
    };
    const db = { prepare: () => statement } as unknown as D1Database;

    const result = await new PlayerRepositoryD1(db).save(player);

    expect(result).toEqual({ ok: false, error: PLAYER_ERRORS.USERNAME_TAKEN });
  });

  it("reports a non-uniqueness player insert failure verbatim", async () => {
    let inserts = 0;
    const statement = {
      bind: () => statement,
      run: async () => {
        inserts++;
        return inserts === 1
          ? { success: true, meta: { changes: 1 } }
          : {
              success: false,
              meta: { changes: 0 },
              error: "database is locked",
            };
      },
    };
    const db = { prepare: () => statement } as unknown as D1Database;

    const result = await new PlayerRepositoryD1(db).save(player);

    expect(result).toEqual({
      ok: false,
      error: "Failed to save player: database is locked",
    });
  });

  it("returns an empty league list when the query yields no rows", async () => {
    const statement = {
      bind: () => statement,
      all: async () => ({ results: null }),
    };
    const db = { prepare: () => statement } as unknown as D1Database;

    const result = await new PlayerRepositoryD1(db).getLeaguesByPlayerId("p-1");

    expect(result).toEqual({ ok: true, value: [] });
  });
});

describe("ContractRepositoryD1 error handling", () => {
  const repository = new ContractRepositoryD1(throwingDb);
  const today = Temporal.PlainDate.from("2026-07-13");

  it("returns a failure when getByTeamId throws", async () => {
    const result = await repository.getByTeamId("team-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Error fetching contracts");
  });

  it("returns a failure when getById throws", async () => {
    const result = await repository.getById("contract-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Error fetching contract");
  });

  it("returns a failure when getByLeagueId throws", async () => {
    const result = await repository.getByLeagueId("league-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Error fetching league contracts");
    }
  });

  it("returns a failure when create throws", async () => {
    const result = await repository.create({
      teamId: "team-1",
      articleId: "Bitcoin",
      purchaseDate: today,
      expireDate: today.add({ days: 7 }),
      purchasePrice: 100,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Error creating contract");
  });

  it("returns a failure when settleSale throws", async () => {
    const result = await repository.settleSale("contract-1", "team-1", 100);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Error selling contract");
  });

  it("returns a failure when getDueForSettlement throws", async () => {
    const result = await repository.getDueForSettlement(today);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Error fetching due contracts");
    }
  });

  it("returns a failure when settleExpiry throws", async () => {
    const result = await repository.settleExpiry("contract-1", 100);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Error settling contract at expiry");
    }
  });

  it("returns a failure when renew throws", async () => {
    const result = await repository.renew(
      "contract-1",
      today,
      today.add({ days: 7 }),
      100,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Error renewing contract");
  });

  it("returns a failure when electRenewal throws", async () => {
    const result = await repository.electRenewal("contract-1", "team-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Error electing contract renewal");
    }
  });

  it("returns a failure when cancelRenewal throws", async () => {
    const result = await repository.cancelRenewal("contract-1", "team-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Error cancelling contract renewal");
    }
  });
});

/**
 * The money-moving writes. Each is a single guarded UPDATE whose result is the
 * only evidence of what happened, so a rejected write must surface as a typed
 * failure — never as `success(false)`, which the settlement sweep reads as "a
 * concurrent run already did this" and would silently skip.
 */
describe("ContractRepositoryD1 failed-write handling", () => {
  const repository = new ContractRepositoryD1(failingRunDb());
  const today = Temporal.PlainDate.from("2026-07-13");

  it("fails the sale rather than reporting no rows changed", async () => {
    const result = await repository.settleSale("contract-1", "team-1", 100);

    expect(result).toEqual({ ok: false, error: "Error settling contract" });
  });

  it("fails the expiry settlement rather than reporting no rows changed", async () => {
    const result = await repository.settleExpiry("contract-1", 100);

    expect(result).toEqual({
      ok: false,
      error: "Error settling contract at expiry",
    });
  });

  it("fails the renewal rather than reporting no rows changed", async () => {
    const result = await repository.renew(
      "contract-1",
      today,
      today.add({ days: 7 }),
      100,
    );

    expect(result).toEqual({ ok: false, error: "Error renewing contract" });
  });

  it("fails the renewal election rather than reporting no rows changed", async () => {
    const result = await repository.electRenewal("contract-1", "team-1");

    expect(result).toEqual({
      ok: false,
      error: "Error electing contract renewal",
    });
  });

  it("fails the renewal cancellation rather than reporting no rows changed", async () => {
    const result = await repository.cancelRenewal("contract-1", "team-1");

    expect(result).toEqual({
      ok: false,
      error: "Error cancelling contract renewal",
    });
  });
});

/**
 * Every repository method funnels its thrown failure through the same
 * `instanceof Error` narrowing. These pin the fallback arm: whatever D1 throws,
 * the caller gets a message it can log, never "undefined".
 */
describe("repositories fall back to a readable message on a non-Error throw", () => {
  const contracts = new ContractRepositoryD1(throwingNonErrorDb);
  const players = new PlayerRepositoryD1(throwingNonErrorDb);
  const teams = new TeamRepositoryD1(throwingNonErrorDb);
  const today = Temporal.PlainDate.from("2026-07-13");

  const calls: [string, () => Promise<{ ok: boolean; error?: string }>][] = [
    ["contracts.getByTeamId", () => contracts.getByTeamId("team-1")],
    ["contracts.getById", () => contracts.getById("contract-1")],
    ["contracts.getByLeagueId", () => contracts.getByLeagueId("league-1")],
    [
      "contracts.create",
      () =>
        contracts.create({
          teamId: "team-1",
          articleId: "Bitcoin",
          purchaseDate: today,
          expireDate: today.add({ days: 7 }),
          purchasePrice: 100,
        }),
    ],
    [
      "contracts.settleSale",
      () => contracts.settleSale("contract-1", "team-1", 100),
    ],
    [
      "contracts.getDueForSettlement",
      () => contracts.getDueForSettlement(today),
    ],
    ["contracts.settleExpiry", () => contracts.settleExpiry("contract-1", 100)],
    [
      "contracts.renew",
      () => contracts.renew("contract-1", today, today.add({ days: 7 }), 100),
    ],
    [
      "contracts.electRenewal",
      () => contracts.electRenewal("contract-1", "team-1"),
    ],
    [
      "contracts.cancelRenewal",
      () => contracts.cancelRenewal("contract-1", "team-1"),
    ],
    [
      "players.save",
      () =>
        players.save({
          username: "user",
          accountId: "account",
          email: "user@example.com",
        }),
    ],
    ["players.getById", () => players.getById("player-1")],
    [
      "players.getLeaguesByPlayerId",
      () => players.getLeaguesByPlayerId("player-1"),
    ],
    [
      "players.getPlayerByAccountId",
      () => players.getPlayerByAccountId("account-1"),
    ],
    [
      "teams.create",
      () =>
        teams.create({
          name: "The Wizards",
          playerId: "player-1",
          leagueId: "league-1",
        }),
    ],
    [
      "teams.existsByNameInLeague",
      () => teams.existsByNameInLeague("The Wizards", "league-1"),
    ],
  ];

  it.each(calls)("%s", async (_name, call) => {
    const result = await call();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Unknown error");
      expect(result.error).not.toContain("undefined");
    }
  });
});
