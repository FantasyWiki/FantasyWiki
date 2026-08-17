import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import { PlayerService } from "../../services/player";
import { TeamService } from "../../services/team";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import { unwrap } from "../../repositories/result";
import { MAX_TEAM_CONTRACTS, STARTING_CREDITS } from "../../../../model/team";
import { repositories } from "../support/target";

/**
 * ADR 0007: a team's credits are derived from its contracts ledger, never
 * stored — so every read path has to answer with the same number. These tests
 * are what stop the four repositories drifting apart, and they say nothing about
 * how the derivation is implemented; `repositories/d1/teamCreditsView.d1.test.ts`
 * covers what is specific to the SQL view.
 */

/** 1000 − 100 − 250 − 40 + 180 + 0 = 790 */
const EXPECTED_CREDITS = 790;

/** One open purchase, so a ledger carrying it holds one active contract. */
const ACTIVE_IN_LEDGER = 1;

/** A team, and a player for it — `teams` is unique on (playerId, leagueId). */
async function teamWithEmptyLedger(name: string): Promise<string> {
  const player = unwrap(
    await new PlayerService(repositories()).createPlayer(
      `user-${name}`,
      `${name}@example.com`,
      `account-${name}`,
    ),
    "player",
  );
  return unwrap(
    await new TeamService(repositories()).createTeam(
      player.id,
      GLOBAL_LEAGUE_ID,
      name,
    ),
    "team",
  ).id;
}

/**
 * A ledger covering every branch of the rule — an open purchase, an early sale
 * that paid out, and a settled one that paid out nothing — leaving the team on
 * EXPECTED_CREDITS. Deliberately not a single purchase: a balance that is the
 * sum of several signed entries is what makes an off-by-one in the derivation
 * visible, which a fresh team's trivial balance would hide.
 */
async function seedLedger(teamId: string): Promise<{ soldContractId: string }> {
  const contracts = repositories().contracts;
  const window = {
    purchaseDate: Temporal.PlainDate.from("2026-01-01"),
    expireDate: Temporal.PlainDate.from("2026-01-04"),
  };

  unwrap(
    await contracts.create({
      teamId,
      articleId: "Article_open",
      purchasePrice: 100,
      ...window,
    }),
    "open contract",
  );

  const sold = unwrap(
    await contracts.create({
      teamId,
      articleId: "Article_sold",
      purchasePrice: 250,
      ...window,
    }),
    "sold contract",
  );
  unwrap(await contracts.settleSale(sold.id, teamId, 180), "sale");

  const worthless = unwrap(
    await contracts.create({
      teamId,
      articleId: "Article_worthless",
      purchasePrice: 40,
      ...window,
    }),
    "worthless contract",
  );
  unwrap(
    await contracts.settleSale(worthless.id, teamId, 0),
    "sale for nothing",
  );

  return { soldContractId: sold.id };
}

describe("Derived team credits (ADR 0007)", () => {
  let playerId: string;
  let teamId: string;
  let soldContractId: string;

  beforeEach(async () => {
    playerId = unwrap(
      await new PlayerService(repositories()).createPlayer(
        "creditsplayer",
        "credits@example.com",
        "account-credits",
      ),
      "player",
    ).id;
    teamId = unwrap(
      await new TeamService(repositories()).createTeam(
        playerId,
        GLOBAL_LEAGUE_ID,
        "Credits FC",
      ),
      "team",
    ).id;

    soldContractId = (await seedLedger(teamId)).soldContractId;
  });

  it("reports the same balance through every read path", async () => {
    // The point of the consolidation: four repositories, one number.
    const { contracts, teams, notifications, performances } = repositories();
    unwrap(
      await notifications.create({
        id: "n1",
        contractId: soldContractId,
        message: "Sold early",
        date: "2026-01-02",
      }),
      "notification",
    );

    const [team, leagueContracts, due, inbox, cumulatives] = await Promise.all([
      teams.getByPlayerAndLeague(playerId, GLOBAL_LEAGUE_ID),
      contracts.getByLeagueId(GLOBAL_LEAGUE_ID),
      // Every fixture contract expired in January 2026, so the open one is due.
      contracts.getDueForSettlement(Temporal.PlainDate.from("2026-06-01")),
      notifications.getByPlayerAndLeague(playerId, GLOBAL_LEAGUE_ID),
      performances.getLeagueCumulatives(GLOBAL_LEAGUE_ID),
    ]);

    const balances = {
      teamRepository: unwrap(team, "team")?.credits,
      contractRepositoryByLeague: unwrap(leagueContracts, "league contracts")[0]
        ?.teamCredits,
      contractRepositoryDueForSettlement: unwrap(due, "due contracts")[0]
        ?.teamCredits,
      notificationRepository: unwrap(inbox, "notifications")[0]?.credits,
      performanceRepository: unwrap(cumulatives, "cumulatives")[0]?.teamCredits,
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
    const emptyTeamId = await teamWithEmptyLedger("Empty FC");

    const cumulatives = unwrap(
      await repositories().performances.getLeagueCumulatives(GLOBAL_LEAGUE_ID),
      "cumulatives",
    );

    const empty = cumulatives.find((row) => row.teamId === emptyTeamId);
    expect(empty?.teamCredits).toBe(STARTING_CREDITS);
  });
});

describe("The guarded purchase write (ADR 0007)", () => {
  let teamId: string;

  // The same multi-entry ledger, so the balance the guard compares against is
  // one the derivation had to compute rather than the starting constant.
  beforeEach(async () => {
    teamId = await teamWithEmptyLedger("Guarded FC");
    await seedLedger(teamId);
  });

  const buyAt = (articleId: string, purchasePrice: number) =>
    repositories().contracts.create({
      teamId,
      articleId,
      purchaseDate: Temporal.PlainDate.from("2026-06-01"),
      expireDate: Temporal.PlainDate.from("2026-06-04"),
      purchasePrice,
    });

  // The guard is `credits >= price`. These pin the comparison itself, not just
  // its existence — a derivation that came out one credit off, or a `>` where
  // `>=` belongs, fails exactly here.
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
    // Prices are 0 so only the cap can cause a rejection, and the ledger's own
    // open purchase already counts towards it.
    for (let held = ACTIVE_IN_LEDGER; held < MAX_TEAM_CONTRACTS; held++) {
      expect((await buyAt(`Filler_${held}`, 0)).ok).toBe(true);
    }

    expect((await buyAt("One_Too_Many", 0)).ok).toBe(false);
  });
});
