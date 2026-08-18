import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import { unwrap } from "../../../repositories/result";
import { GLOBAL_LEAGUE_ID } from "../../../services/league";
import { repositories } from "../../support/target";
import { aTeamIn, creditsOf, unique } from "./subjects";
import { STARTING_CREDITS, deriveCredits } from "../../../../../model/team";
import type { Team } from "../../../../../model";

/**
 * The one rule that spans repositories, so it gets a file of its own rather than
 * living under any single one: credits are derived from the contracts ledger on
 * every read and never stored (ADR 0007). Two things follow, and both are what a
 * second implementation has to reproduce — every read path must answer the same
 * number, and the purchase write must compare against that same number.
 *
 * `deriveCredits` is the shared, readable statement of the rule; using it as the
 * oracle here is what stops the store and the rule drifting apart.
 */

/** An open purchase, a sale that paid out, and a sale that paid nothing. */
const LEDGER = [
  { purchasePrice: 100, settled: false },
  { purchasePrice: 250, settled: true, salePayout: 180 },
  { purchasePrice: 40, settled: true, salePayout: 0 },
];

const EXPECTED_CREDITS = deriveCredits(STARTING_CREDITS, LEDGER);

/** Both entries lapsed in January, so the open one is due for settlement. */
const LAPSED = {
  purchaseDate: Temporal.PlainDate.from("2026-01-01"),
  expireDate: Temporal.PlainDate.from("2026-01-04"),
};

describe("derived credits conformance", () => {
  let team: Team;
  let soldContractId: string;

  beforeEach(async () => {
    const contracts = repositories().contracts;
    team = await aTeamIn(GLOBAL_LEAGUE_ID);

    // Deliberately several signed entries rather than one purchase: a balance
    // that had to be summed is what makes an off-by-one in the derivation
    // visible, where a fresh team's would not.
    for (const entry of LEDGER) {
      const contract = unwrap(
        await contracts.create({
          teamId: team.id,
          articleId: unique("Article"),
          purchasePrice: entry.purchasePrice,
          ...LAPSED,
        }),
        "ledger entry",
      );
      if (entry.settled) {
        unwrap(
          await contracts.settleSale(
            contract.id,
            team.id,
            entry.salePayout ?? 0,
          ),
          "sale",
        );
        soldContractId = contract.id;
      }
    }
  });

  it("reports the same balance through every read path", async () => {
    const { contracts, teams, notifications, performances } = repositories();
    unwrap(
      await notifications.create({
        id: unique("notification"),
        contractId: soldContractId,
        message: "Sold early",
        date: "2026-01-02",
      }),
      "notification",
    );

    const [byTeam, byLeague, due, inbox, standings] = await Promise.all([
      teams.getByPlayerAndLeague(team.playerId, GLOBAL_LEAGUE_ID),
      contracts.getByLeagueId(GLOBAL_LEAGUE_ID),
      contracts.getDueForSettlement(Temporal.PlainDate.from("2026-06-01")),
      notifications.getByPlayerAndLeague(team.playerId, GLOBAL_LEAGUE_ID),
      performances.getLeagueCumulatives(GLOBAL_LEAGUE_ID),
    ]);

    const ours = <T extends { teamId: string }>(rows: T[]) =>
      rows.find((row) => row.teamId === team.id);

    // Five paths, four repositories, one number.
    expect({
      teamRepository: unwrap(byTeam, "team")?.credits,
      contractsByLeague: ours(unwrap(byLeague, "league contracts"))
        ?.teamCredits,
      contractsDueForSettlement: ours(unwrap(due, "due contracts"))
        ?.teamCredits,
      notificationRepository: ours(unwrap(inbox, "inbox"))?.credits,
      performanceRepository: ours(unwrap(standings, "standings"))?.teamCredits,
    }).toEqual({
      teamRepository: EXPECTED_CREDITS,
      contractsByLeague: EXPECTED_CREDITS,
      contractsDueForSettlement: EXPECTED_CREDITS,
      notificationRepository: EXPECTED_CREDITS,
      performanceRepository: EXPECTED_CREDITS,
    });
  });

  it("reports a contract-free team's balance as the starting budget", async () => {
    // A team with an empty ledger sums to the starting budget, which is why
    // `create` takes no credits parameter.
    const fresh = await aTeamIn(GLOBAL_LEAGUE_ID);

    expect(await creditsOf(fresh)).toBe(STARTING_CREDITS);
  });

  // The purchase guard compares `credits >= price` against this derived balance.
  // These two pin the comparison itself: a derivation that came out a credit
  // off, or a `>` where `>=` belongs, fails exactly here.
  it("lets the team spend its entire derived balance", async () => {
    const exact = await repositories().contracts.create({
      teamId: team.id,
      articleId: "Exact_Article",
      purchaseDate: Temporal.PlainDate.from("2026-06-01"),
      expireDate: Temporal.PlainDate.from("2026-06-04"),
      purchasePrice: EXPECTED_CREDITS,
    });

    expect(exact.ok).toBe(true);
  });

  it("refuses one credit beyond the derived balance", async () => {
    const overspend = await repositories().contracts.create({
      teamId: team.id,
      articleId: "Dear_Article",
      purchaseDate: Temporal.PlainDate.from("2026-06-01"),
      expireDate: Temporal.PlainDate.from("2026-06-04"),
      purchasePrice: EXPECTED_CREDITS + 1,
    });

    expect(overspend.ok).toBe(false);
  });

  it("counts a purchase against the balance as soon as it lands", async () => {
    unwrap(
      await repositories().contracts.create({
        teamId: team.id,
        articleId: "Another_Article",
        purchaseDate: Temporal.PlainDate.from("2026-06-01"),
        expireDate: Temporal.PlainDate.from("2026-06-04"),
        purchasePrice: 30,
      }),
      "purchase",
    );

    // No debit step: the entry itself is the debit.
    expect(await creditsOf(team)).toBe(
      deriveCredits(STARTING_CREDITS, [
        ...LEDGER,
        { purchasePrice: 30, settled: false },
      ]),
    );
  });
});
