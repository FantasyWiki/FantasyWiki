import { Temporal } from "@js-temporal/polyfill";
import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import { ContractRepositoryD1 } from "../../repositories/d1/contractRepositoryD1";
import { NotificationRepositoryD1 } from "../../repositories/d1/notificationRepositoryD1";
import { PerformanceRepositoryD1 } from "../../repositories/d1/performanceRepositoryD1";
import { TeamRepositoryD1 } from "../../repositories/d1/teamRepositoryD1";
import {
  MAX_TEAM_CONTRACTS,
  STARTING_CREDITS,
  deriveCredits,
} from "../../../../model/team";
import { resetD1Database, insertTeam } from "../utils/d1TestUtils";

/**
 * ADR 0007: credits are derived by the `team_credits` view — one statement of
 * the rule, used by every read path and the guarded INSERT. These tests are
 * what stop the four repositories drifting back apart.
 */

const LEAGUE_ID = "league-credits";
const PLAYER_ID = "player-credits";
const TEAM_ID = "team-credits";

/** Covers every branch: unsettled purchase, early sale, and a settled row with a NULL payout. */
const LEDGER = [
  { id: "c-open", purchasePrice: 100, settled: false, salePayout: null },
  { id: "c-sold", purchasePrice: 250, settled: true, salePayout: 180 },
  { id: "c-null", purchasePrice: 40, settled: true, salePayout: null },
];

/** 1000 − 100 − 250 − 40 + 180 + 0 = 790 */
const EXPECTED_CREDITS = 790;

async function seedLedger(): Promise<void> {
  await env.db
    .prepare(
      `INSERT INTO google_accounts (id, googleId, email) VALUES (?, ?, ?)`,
    )
    .bind("account-credits", "google-credits", "credits@example.com")
    .run();
  await env.db
    .prepare(`INSERT INTO players (id, username, accountId) VALUES (?, ?, ?)`)
    .bind(PLAYER_ID, "creditsplayer", "account-credits")
    .run();
  await env.db
    .prepare(
      `INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      LEAGUE_ID,
      "Credits League",
      PLAYER_ID,
      "2026-01-01",
      "2026-12-31",
      "en",
      "🌍",
    )
    .run();
  await insertTeam(env.db, {
    id: TEAM_ID,
    name: "Credits FC",
    playerId: PLAYER_ID,
    leagueId: LEAGUE_ID,
  });

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
}

/** A contract-free team. `teams` is unique on (playerId, leagueId), so it brings its own player. */
async function seedTeamWithEmptyLedger(teamId: string): Promise<void> {
  await env.db
    .prepare(
      `INSERT INTO google_accounts (id, googleId, email) VALUES (?, ?, ?)`,
    )
    .bind(`account-${teamId}`, `google-${teamId}`, `${teamId}@example.com`)
    .run();
  await env.db
    .prepare(`INSERT INTO players (id, username, accountId) VALUES (?, ?, ?)`)
    .bind(`player-${teamId}`, `user-${teamId}`, `account-${teamId}`)
    .run();
  await insertTeam(env.db, {
    id: teamId,
    name: `Team ${teamId}`,
    playerId: `player-${teamId}`,
    leagueId: LEAGUE_ID,
  });
}

describe("Derived team credits (ADR 0007)", () => {
  beforeEach(async () => {
    await resetD1Database(env.db);
    await seedLedger();
  });

  it("pins the view's starting-budget literal to STARTING_CREDITS", async () => {
    // The only thing keeping the inlined literal and the TS constant in step.
    await seedTeamWithEmptyLedger("team-fresh");

    const row = await env.db
      .prepare("SELECT credits FROM team_credits WHERE teamId = ?")
      .bind("team-fresh")
      .first<{ credits: number }>();

    expect(row?.credits).toBe(STARTING_CREDITS);
  });

  it("agrees with the model's deriveCredits on the same ledger", async () => {
    // The view enforces, the pure function documents — same rule.
    expect(deriveCredits(STARTING_CREDITS, LEDGER)).toBe(EXPECTED_CREDITS);

    const row = await env.db
      .prepare("SELECT credits FROM team_credits WHERE teamId = ?")
      .bind(TEAM_ID)
      .first<{ credits: number }>();

    expect(row?.credits).toBe(EXPECTED_CREDITS);
  });

  it("reports the same balance through every read path", async () => {
    // The point of the consolidation: four repositories, one number.
    await env.db
      .prepare(
        `INSERT INTO notifications (id, contractId, message, date, isRead)
         VALUES ('n1', 'c-sold', 'Sold early', '2026-01-02', 0)`,
      )
      .run();

    const contractRepo = new ContractRepositoryD1(env.db);
    const teamRepo = new TeamRepositoryD1(env.db);
    const notificationRepo = new NotificationRepositoryD1(env.db);
    const performanceRepo = new PerformanceRepositoryD1(env.db);

    const [team, leagueContracts, due, notifications, cumulatives] =
      await Promise.all([
        teamRepo.getByPlayerAndLeague(PLAYER_ID, LEAGUE_ID),
        contractRepo.getByLeagueId(LEAGUE_ID),
        // Every fixture contract expired in January 2026, so the open one is due.
        contractRepo.getDueForSettlement(Temporal.PlainDate.from("2026-06-01")),
        notificationRepo.getByPlayerAndLeague(PLAYER_ID, LEAGUE_ID),
        performanceRepo.getLeagueCumulatives(LEAGUE_ID),
      ]);

    if (
      !team.ok ||
      !leagueContracts.ok ||
      !due.ok ||
      !notifications.ok ||
      !cumulatives.ok
    ) {
      throw new Error("read path failed");
    }

    const balances = {
      teamRepository: team.value?.credits,
      contractRepositoryByLeague: leagueContracts.value[0]?.teamCredits,
      contractRepositoryDueForSettlement: due.value[0]?.teamCredits,
      notificationRepository: notifications.value[0]?.credits,
      performanceRepository: cumulatives.value[0]?.teamCredits,
    };

    expect(balances).toEqual({
      teamRepository: EXPECTED_CREDITS,
      contractRepositoryByLeague: EXPECTED_CREDITS,
      contractRepositoryDueForSettlement: EXPECTED_CREDITS,
      notificationRepository: EXPECTED_CREDITS,
      performanceRepository: EXPECTED_CREDITS,
    });
  });

  it("still reports a contract-free team's balance on the leaderboard", async () => {
    // Team-anchoring is what lets performanceRepository drop its COALESCE.
    await seedTeamWithEmptyLedger("team-empty");

    const cumulatives = await new PerformanceRepositoryD1(
      env.db,
    ).getLeagueCumulatives(LEAGUE_ID);
    if (!cumulatives.ok) throw new Error("read path failed");

    const empty = cumulatives.value.find((row) => row.teamId === "team-empty");
    expect(empty?.teamCredits).toBe(STARTING_CREDITS);
  });
});

describe("The guarded purchase INSERT (ADR 0007)", () => {
  // The guard now reads the view; these pin the behaviour that justifies it.
  beforeEach(async () => {
    await resetD1Database(env.db);
    await seedLedger();
  });

  const buyAt = (articleId: string, purchasePrice: number) =>
    new ContractRepositoryD1(env.db).create({
      teamId: TEAM_ID,
      articleId,
      purchaseDate: Temporal.PlainDate.from("2026-06-01"),
      expireDate: Temporal.PlainDate.from("2026-06-04"),
      purchasePrice,
    });

  // The guard is `credits >= price`. These two pin the comparison itself, not
  // just its existence — a view substitution that changed the derived number
  // by one, or flipped >= to >, fails exactly here.
  it("allows a purchase costing the entire balance", async () => {
    const exact = await buyAt("Exact_Article", EXPECTED_CREDITS);
    expect(exact.ok).toBe(true);
  });

  it("rejects a purchase one credit beyond the balance", async () => {
    const overspend = await buyAt("Dear_Article", EXPECTED_CREDITS + 1);
    expect(overspend.ok).toBe(false);
  });

  it("rejects any further spend once the balance is exhausted", async () => {
    expect((await buyAt("Exact_Article", EXPECTED_CREDITS)).ok).toBe(true);
    expect((await buyAt("One_Credit_More", 1)).ok).toBe(false);
  });

  it("rejects the contract past MAX_TEAM_CONTRACTS", async () => {
    const repo = new ContractRepositoryD1(env.db);
    // Prices are 0 so only the cap can cause a rejection.
    const activeAlready = LEDGER.filter((row) => !row.settled).length;

    for (let i = activeAlready; i < MAX_TEAM_CONTRACTS; i++) {
      const result = await repo.create({
        teamId: TEAM_ID,
        articleId: `Filler_${i}`,
        purchaseDate: Temporal.PlainDate.from("2026-06-01"),
        expireDate: Temporal.PlainDate.from("2026-06-04"),
        purchasePrice: 0,
      });
      expect(result.ok).toBe(true);
    }

    const overCap = await repo.create({
      teamId: TEAM_ID,
      articleId: "One_Too_Many",
      purchaseDate: Temporal.PlainDate.from("2026-06-01"),
      expireDate: Temporal.PlainDate.from("2026-06-04"),
      purchasePrice: 0,
    });
    expect(overCap.ok).toBe(false);
  });
});
