import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import { CONTRACT_WRITE_ERRORS } from "../../../repositories/contractRepository";
import { unwrap } from "../../../repositories/result";
import { GLOBAL_LEAGUE_ID } from "../../../services/league";
import { repositories, store } from "../../support/target";
import { aPlayer, aTeamIn, creditsOf, unique } from "./subjects";
import {
  MAX_TEAM_CONTRACTS,
  STARTING_CREDITS,
  deriveCredits,
} from "../../../../../model/team";
import type { Contract, Team } from "../../../../../model";

const OPENED = Temporal.Now.plainDateISO();
const EXPIRES = OPENED.add({ days: 7 });

/** A contract held over the window above, which no test here varies. */
async function hold(
  teamId: string,
  articleId: string,
  purchasePrice: number,
): Promise<Contract> {
  return unwrap(
    await repositories().contracts.create({
      teamId,
      articleId,
      purchaseDate: OPENED,
      expireDate: EXPIRES,
      purchasePrice,
    }),
    `contract on ${articleId}`,
  );
}

/**
 * What any ContractRepository owes its callers.
 *
 * The purchase conditions and the lifecycle guards are stated as the write's own
 * answer, never as how it is reached. `create`'s contract names all three
 * conditions, and they belong to the write rather than to a caller for one
 * reason: a service-side pre-check leaves a read-then-write race open, so two
 * concurrent buys could both pass a check and land one contract too many
 * (ADR 0007). An implementation may use whatever atomicity its store provides.
 *
 * Balances are expected against `deriveCredits`, the shared statement of the
 * credits rule, rather than against arithmetic written out here — so what these
 * assert is that the store and the rule agree over the same ledger.
 */
describe("ContractRepository conformance", () => {
  let team: Team;

  beforeEach(async () => {
    team = await aTeamIn(GLOBAL_LEAGUE_ID);
  });

  describe("the purchase write enforces every condition itself", () => {
    it("refuses an article another team in the league holds", async () => {
      const rival = await aTeamIn(GLOBAL_LEAGUE_ID);
      await hold(rival.id, "Bitcoin", 10);

      const result = await repositories().contracts.create({
        teamId: team.id,
        articleId: "Bitcoin",
        purchaseDate: OPENED,
        expireDate: EXPIRES,
        purchasePrice: 10,
      });

      // One sentinel for every condition: at write time the store knows only
      // that a guard failed, not which. Callers re-read to name the cause.
      expect(result).toEqual({
        ok: false,
        error: CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT,
      });
    });

    it("refuses an article the team already holds", async () => {
      await hold(team.id, "Bitcoin", 10);

      const again = await repositories().contracts.create({
        teamId: team.id,
        articleId: "Bitcoin",
        purchaseDate: OPENED,
        expireDate: EXPIRES,
        purchasePrice: 10,
      });

      expect(again.ok).toBe(false);
    });

    it("frees the article once the holding is settled", async () => {
      const rival = await aTeamIn(GLOBAL_LEAGUE_ID);
      const held = await hold(rival.id, "Bitcoin", 10);
      unwrap(
        await repositories().contracts.settleSale(held.id, rival.id, 5),
        "sale",
      );

      // Exclusivity is over active holdings, so the article is available again.
      expect((await hold(team.id, "Bitcoin", 10)).articleId).toBe("Bitcoin");
    });

    it("does not let a holding in another league block the article", async () => {
      const elsewhere = await store().createLeague({
        id: unique("league"),
        name: "Another League",
        adminId: await aPlayer(),
      });
      const foreign = await aTeamIn(elsewhere.id);
      await hold(foreign.id, "Bitcoin", 10);

      expect((await hold(team.id, "Bitcoin", 10)).articleId).toBe("Bitcoin");
    });

    it("refuses a purchase the balance cannot cover", async () => {
      const overspend = await repositories().contracts.create({
        teamId: team.id,
        articleId: "Dear_Article",
        purchaseDate: OPENED,
        expireDate: EXPIRES,
        purchasePrice: STARTING_CREDITS + 1,
      });

      expect(overspend.ok).toBe(false);
    });

    it(`refuses the contract past MAX_TEAM_CONTRACTS (${MAX_TEAM_CONTRACTS})`, async () => {
      // Free, so only the cap can be what rejects the last one.
      for (let held = 0; held < MAX_TEAM_CONTRACTS; held++) {
        await hold(team.id, unique("Filler"), 0);
      }

      const overCap = await repositories().contracts.create({
        teamId: team.id,
        articleId: "One_Too_Many",
        purchaseDate: OPENED,
        expireDate: EXPIRES,
        purchasePrice: 0,
      });

      expect(overCap.ok).toBe(false);
    });

    it("counts a settled holding as freeing a place under the cap", async () => {
      for (let held = 0; held < MAX_TEAM_CONTRACTS - 1; held++) {
        await hold(team.id, unique("Filler"), 0);
      }
      const last = await hold(team.id, unique("Filler"), 0);
      unwrap(
        await repositories().contracts.settleSale(last.id, team.id, 0),
        "sale",
      );

      const replacement = await repositories().contracts.create({
        teamId: team.id,
        articleId: "Replacement",
        purchaseDate: OPENED,
        expireDate: EXPIRES,
        purchasePrice: 0,
      });

      expect(replacement.ok).toBe(true);
    });
  });

  /**
   * The settlement sweep retries per contract and can overlap a player's own
   * action, so each of these writes reports whether *this* call was the one that
   * took effect — and a replay has to change nothing.
   */
  describe("the lifecycle writes report who won and replay cleanly", () => {
    it("settles a sale once", async () => {
      const contracts = repositories().contracts;
      const contract = await hold(team.id, "Bitcoin", 100);

      expect(
        unwrap(await contracts.settleSale(contract.id, team.id, 40), "sale"),
      ).toBe(true);
      expect(
        unwrap(await contracts.settleSale(contract.id, team.id, 40), "replay"),
      ).toBe(false);
      // Nothing paid out twice. The payout has no reader of its own — it is only
      // ever visible as the balance it moved.
      expect(await creditsOf(team)).toBe(
        deriveCredits(STARTING_CREDITS, [
          { purchasePrice: 100, settled: true, salePayout: 40 },
        ]),
      );
    });

    it("refuses a sale by a team that does not hold the contract", async () => {
      const contracts = repositories().contracts;
      const contract = await hold(team.id, "Bitcoin", 10);
      const other = await aTeamIn(GLOBAL_LEAGUE_ID);

      expect(
        unwrap(
          await contracts.settleSale(contract.id, other.id, 40),
          "foreign sale",
        ),
      ).toBe(false);
      expect(
        unwrap(await contracts.getById(contract.id), "contract")?.settled,
      ).toBe(false);
    });

    it("settles an expiry once", async () => {
      const contracts = repositories().contracts;
      const contract = await hold(team.id, "Bitcoin", 100);

      expect(
        unwrap(await contracts.settleExpiry(contract.id, 60), "expiry"),
      ).toBe(true);
      expect(
        unwrap(await contracts.settleExpiry(contract.id, 60), "replay"),
      ).toBe(false);
      expect(await creditsOf(team)).toBe(
        deriveCredits(STARTING_CREDITS, [
          { purchasePrice: 100, settled: true, salePayout: 60 },
        ]),
      );
    });

    it("refuses to settle at expiry what was already sold", async () => {
      const contracts = repositories().contracts;
      const contract = await hold(team.id, "Bitcoin", 10);
      unwrap(await contracts.settleSale(contract.id, team.id, 10), "sale");

      expect(
        unwrap(await contracts.settleExpiry(contract.id, 10), "expiry"),
      ).toBe(false);
    });

    it("records a renewal election, and says so again if asked twice", async () => {
      const contracts = repositories().contracts;
      const contract = await hold(team.id, "Bitcoin", 10);

      expect(
        unwrap(await contracts.electRenewal(contract.id, team.id), "election"),
      ).toBe(true);
      // Electable, not flag-flipped: a stale client re-electing is told the
      // truth rather than having `false` turned into a 404 by the service.
      expect(
        unwrap(await contracts.electRenewal(contract.id, team.id), "re-elect"),
      ).toBe(true);
      expect(
        unwrap(await contracts.getById(contract.id), "contract")
          ?.renewalElected,
      ).toBe(true);
    });

    it("refuses an election on a contract the team does not hold", async () => {
      const contracts = repositories().contracts;
      const contract = await hold(team.id, "Bitcoin", 10);
      const other = await aTeamIn(GLOBAL_LEAGUE_ID);

      expect(
        unwrap(
          await contracts.electRenewal(contract.id, other.id),
          "foreign election",
        ),
      ).toBe(false);
    });

    it("withdraws an election once", async () => {
      const contracts = repositories().contracts;
      const contract = await hold(team.id, "Bitcoin", 10);
      unwrap(await contracts.electRenewal(contract.id, team.id), "election");

      expect(
        unwrap(
          await contracts.cancelRenewal(contract.id, team.id),
          "withdrawal",
        ),
      ).toBe(true);
      // Guarded on the election still standing — the asymmetry with electing is
      // deliberate, so a withdrawal arriving after the sweep renewed the
      // contract loses the race instead of quietly un-electing it.
      expect(
        unwrap(
          await contracts.cancelRenewal(contract.id, team.id),
          "re-withdraw",
        ),
      ).toBe(false);
    });

    it("renews only what is elected, rolling the window and counting it", async () => {
      const contracts = repositories().contracts;
      const contract = await hold(team.id, "Bitcoin", 100);
      const rolled = EXPIRES.add({ days: 7 });

      // Not elected: there is nothing for the sweep to renew.
      expect(
        unwrap(
          await contracts.renew(contract.id, EXPIRES, rolled, 120),
          "unelected renewal",
        ),
      ).toBe(false);

      unwrap(await contracts.electRenewal(contract.id, team.id), "election");
      expect(
        unwrap(
          await contracts.renew(contract.id, EXPIRES, rolled, 120),
          "renewal",
        ),
      ).toBe(true);

      const renewed = unwrap(await contracts.getById(contract.id), "contract");
      expect(renewed?.purchaseDate.toString()).toBe(EXPIRES.toString());
      expect(renewed?.expireDate.toString()).toBe(rolled.toString());
      expect(renewed?.purchasePrice).toBe(120);
      expect(renewed?.renewalCount).toBe(1);
      // The election is spent, so a re-run of the sweep renews nothing further.
      expect(renewed?.renewalElected).toBe(false);
      expect(
        unwrap(
          await contracts.renew(
            contract.id,
            rolled,
            rolled.add({ days: 7 }),
            130,
          ),
          "replay",
        ),
      ).toBe(false);
    });
  });

  describe("reads", () => {
    it("answers null for a contract that does not exist", async () => {
      expect(
        unwrap(
          await repositories().contracts.getById("no-such-contract"),
          "read",
        ),
      ).toBeNull();
    });

    it("returns a team's holdings, settled ones included", async () => {
      const contracts = repositories().contracts;
      const kept = await hold(team.id, "Kept", 10);
      const sold = await hold(team.id, "Sold", 10);
      unwrap(await contracts.settleSale(sold.id, team.id, 5), "sale");

      const holdings = unwrap(
        await contracts.getByTeamId(team.id),
        "team's contracts",
      );

      // The ledger keeps settled rows: the balance is derived from them, and a
      // sale notification still points at one.
      expect(holdings.map((contract) => contract.id).sort()).toEqual(
        [kept.id, sold.id].sort(),
      );
    });

    it("picks up only unsettled contracts at or past their expiry", async () => {
      const contracts = repositories().contracts;
      const today = Temporal.Now.plainDateISO();
      const lapsed = {
        purchaseDate: today.subtract({ days: 7 }),
        expireDate: today,
      };
      const due = unwrap(
        await contracts.create({
          teamId: team.id,
          articleId: "Due",
          purchasePrice: 10,
          ...lapsed,
        }),
        "due contract",
      );
      const settled = unwrap(
        await contracts.create({
          teamId: team.id,
          articleId: "Settled",
          purchasePrice: 10,
          ...lapsed,
        }),
        "settled contract",
      );
      unwrap(await contracts.settleExpiry(settled.id, 10), "expiry");
      await hold(team.id, "Future", 10);

      const sweep = unwrap(
        await contracts.getDueForSettlement(today),
        "due contracts",
      );

      expect(sweep.map((contract) => contract.id)).toEqual([due.id]);
      // Enriched with what the settlement needs, so the sweep does not read it
      // back per contract: the league's domain prices the article, and the
      // balance decides whether an elected renewal is affordable.
      expect(sweep[0].domain).toBe("en");
      expect(sweep[0].teamCredits).toBe(
        deriveCredits(STARTING_CREDITS, [
          { purchasePrice: 10, settled: false },
          { purchasePrice: 10, settled: true, salePayout: 10 },
          { purchasePrice: 10, settled: false },
        ]),
      );
    });
  });
});
