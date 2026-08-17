import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import { STARTING_CREDITS, deriveCredits } from "../../../../../model/team";
import { GLOBAL_LEAGUE_ID } from "../../../services/league";

/**
 * ADR 0007 states the credits rule once, in the `team_credits` SQL view, and
 * every D1 read path joins it. Two things about that view cannot be checked
 * through the repository interfaces, so they are checked here:
 *
 *  - its starting-budget literal is inlined, so only a test can keep it in step
 *    with the `STARTING_CREDITS` constant;
 *  - `salePayout` is nullable, and a settled row that never got one — written
 *    before migration 0005 added the column — must count as a zero payout. No
 *    repository method can produce that row, because `settleSale` always writes
 *    a number.
 *
 * Everything else about derived credits is target-agnostic and lives in
 * `integration/teamCredits.integration.test.ts`.
 */

const PLAYER_ID = "player-view";
const TEAM_ID = "team-view";

/** Includes the row the interfaces cannot make: settled, with a NULL payout. */
const LEDGER = [
  { id: "c-open", purchasePrice: 100, settled: false, salePayout: null },
  { id: "c-sold", purchasePrice: 250, settled: true, salePayout: 180 },
  { id: "c-null", purchasePrice: 40, settled: true, salePayout: null },
];

/** 1000 − 100 − 250 − 40 + 180 + 0 = 790 */
const EXPECTED_CREDITS = 790;

async function creditsOf(teamId: string): Promise<number | undefined> {
  const row = await env.db
    .prepare("SELECT credits FROM team_credits WHERE teamId = ?")
    .bind(teamId)
    .first<{ credits: number }>();
  return row?.credits;
}

async function seedTeam(teamId: string, playerId: string): Promise<void> {
  await env.db
    .prepare(
      "INSERT INTO google_accounts (id, googleId, email) VALUES (?, ?, ?)",
    )
    .bind(`account-${teamId}`, `google-${teamId}`, `${teamId}@example.com`)
    .run();
  await env.db
    .prepare("INSERT INTO players (id, username, accountId) VALUES (?, ?, ?)")
    .bind(playerId, `user-${teamId}`, `account-${teamId}`)
    .run();
  await env.db
    .prepare(
      "INSERT INTO teams (id, name, playerId, leagueId) VALUES (?, ?, ?, ?)",
    )
    .bind(teamId, `Team ${teamId}`, playerId, GLOBAL_LEAGUE_ID)
    .run();
}

describe("the team_credits view", () => {
  beforeEach(async () => {
    await seedTeam(TEAM_ID, PLAYER_ID);
    for (const row of LEDGER) {
      await env.db
        .prepare(
          `INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice, settled, salePayout)
           VALUES (?, ?, ?, '2026-01-01', '2026-01-04', ?, ?, ?)`,
        )
        .bind(
          row.id,
          TEAM_ID,
          `Article_${row.id}`,
          row.purchasePrice,
          row.settled ? 1 : 0,
          row.salePayout,
        )
        .run();
    }
  });

  it("pins its starting-budget literal to STARTING_CREDITS", async () => {
    await seedTeam("team-fresh", "player-fresh");

    expect(await creditsOf("team-fresh")).toBe(STARTING_CREDITS);
  });

  it("agrees with the model's deriveCredits over the same ledger", async () => {
    // The view enforces, the pure function documents — same rule, and the
    // NULL payout has to count as zero in both.
    expect(deriveCredits(STARTING_CREDITS, LEDGER)).toBe(EXPECTED_CREDITS);

    expect(await creditsOf(TEAM_ID)).toBe(EXPECTED_CREDITS);
  });
});
