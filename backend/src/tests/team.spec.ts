import { describe, it, expect } from "vitest";
import {
  deriveCredits,
  deriveCreditsFromLedger,
  STARTING_CREDITS,
  type CreditLedgerEntry,
} from "../../../model/team";

/**
 * The canonical statement of the Team aggregate's core invariant (ADR 0007).
 * These assert the *rule*; the equivalent `team_credits` view is asserted
 * against these same numbers in team.integration.test.ts.
 */
describe("deriveCredits", () => {
  it("returns the starting budget for a team that has bought nothing", () => {
    expect(deriveCredits(STARTING_CREDITS, [], [])).toBe(STARTING_CREDITS);
  });

  it("subtracts every purchase price", () => {
    expect(deriveCredits(1000, [150, 80, 20], [])).toBe(750);
  });

  it("adds back payouts recovered from settled contracts", () => {
    expect(deriveCredits(1000, [150, 80], [90])).toBe(860);
  });

  it("can leave a team richer than it started when payouts beat purchases", () => {
    expect(deriveCredits(1000, [100], [340])).toBe(1240);
  });

  it("does not floor at zero — overspending would be visible, not hidden", () => {
    // Nothing in the derivation clamps: a negative balance means the guarded
    // INSERT let something through, and the read should show it rather than
    // silently reporting 0.
    expect(deriveCredits(1000, [1200], [])).toBe(-200);
  });

  it("handles fractional prices without rounding", () => {
    expect(deriveCredits(1000, [10.5, 3.25], [1.75])).toBe(988);
  });
});

describe("deriveCreditsFromLedger", () => {
  const unsettled = (purchasePrice: number): CreditLedgerEntry => ({
    purchasePrice,
    settled: false,
    salePayout: null,
  });
  const settled = (
    purchasePrice: number,
    salePayout: number,
  ): CreditLedgerEntry => ({ purchasePrice, settled: true, salePayout });

  it("returns the starting budget for an empty ledger", () => {
    expect(deriveCreditsFromLedger(STARTING_CREDITS, [])).toBe(
      STARTING_CREDITS,
    );
  });

  it("counts an unsettled contract as spent and recovers nothing", () => {
    expect(deriveCreditsFromLedger(1000, [unsettled(150)])).toBe(850);
  });

  it("recovers the payout once a contract is settled", () => {
    expect(deriveCreditsFromLedger(1000, [settled(150, 90)])).toBe(940);
  });

  it("ignores a payout written on a contract that is not settled yet", () => {
    // Mirrors the view's `CASE WHEN settled = 1`: settlement, not the presence
    // of a payout value, is what releases the credits.
    const ledger: CreditLedgerEntry[] = [
      { purchasePrice: 150, settled: false, salePayout: 90 },
    ];
    expect(deriveCreditsFromLedger(1000, ledger)).toBe(850);
  });

  it("treats a settled contract with no payout as recovering nothing", () => {
    const ledger: CreditLedgerEntry[] = [
      { purchasePrice: 150, settled: true, salePayout: null },
    ];
    expect(deriveCreditsFromLedger(1000, ledger)).toBe(850);
  });

  it("sums a mixed ledger of held and settled contracts", () => {
    const ledger = [
      unsettled(150),
      unsettled(80),
      settled(200, 260),
      settled(50, 10),
    ];
    expect(deriveCreditsFromLedger(STARTING_CREDITS, ledger)).toBe(790);
  });

  it("agrees with deriveCredits on the same ledger", () => {
    const ledger = [unsettled(150), settled(200, 260)];

    expect(deriveCreditsFromLedger(STARTING_CREDITS, ledger)).toBe(
      deriveCredits(STARTING_CREDITS, [150, 200], [260]),
    );
  });
});
