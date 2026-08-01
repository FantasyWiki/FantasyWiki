export interface Team {
  id: string;
  name: string;
  playerId: string;
  leagueId: string;
  credits: number;
}

/**
 * ADR 0003/0005: starting budget for every new team — 1,000 credits, no
 * per-language scale factor needed (points-based pricing doesn't reproduce
 * the rounding-to-zero issue the old views^1.5 formula had). Lives in the
 * shared model package rather than backend-only because both surfaces need
 * it: the frontend to explain the budget to a new player, and the backend as
 * the base of the credit derivation below.
 *
 * The `team_credits` SQL view inlines this value (SQLite views take no
 * parameters). The two MUST stay equal — an integration test asserts it.
 */
export const STARTING_CREDITS = 1000;

/**
 * Maximum number of active (unsettled) contracts a team may hold. Lives in
 * the shared model because the repository layer enforces it inside the same
 * guarded contract INSERT that checks the derived credits.
 */
export const MAX_TEAM_CONTRACTS = 22;

/**
 * The part of a contract the credit derivation reads. Deliberately narrower
 * than `Contract`: credits depend on the price paid and, once settled, the
 * payout recovered — nothing else about the contract's lifecycle.
 */
export interface CreditLedgerEntry {
  purchasePrice: number;
  settled: boolean;
  /** Proceeds recovered at settlement (early sale or expiry). Null until settled. */
  salePayout: number | null;
}

/**
 * A team's credit balance — the Team aggregate's core invariant:
 *
 * ```
 * credits = startingCredits − Σ purchasePrice + Σ salePayout (where settled)
 * ```
 *
 * Credits are **derived, never stored**: there is no balance column to drift
 * out of sync with the contracts ledger.
 *
 * This function is the canonical, readable statement of the rule, and what the
 * model tests assert against. It is **not** what runs in production: the
 * balance is enforced at the write, inside a single guarded `INSERT` that
 * reads the equivalent `team_credits` SQL view, because splitting the check
 * from the write would let two concurrent purchases both pass it. See
 * `docs/adr/0007-team-credits-derived-and-enforced-at-write.md` for the race
 * that shape prevents and why the duplication between here and SQL is
 * deliberate.
 */
export function deriveCredits(
  startingCredits: number,
  purchases: readonly number[],
  payouts: readonly number[],
): number {
  const spent = purchases.reduce((sum, price) => sum + price, 0);
  const recovered = payouts.reduce((sum, payout) => sum + payout, 0);
  return startingCredits - spent + recovered;
}

/**
 * `deriveCredits` applied to a team's whole contracts ledger, doing the
 * "where settled" selection the SQL view's `CASE WHEN settled = 1` does.
 * Unsettled contracts contribute their purchase price only — a contract still
 * held has cost its price and recovered nothing.
 */
export function deriveCreditsFromLedger(
  startingCredits: number,
  ledger: readonly CreditLedgerEntry[],
): number {
  return deriveCredits(
    startingCredits,
    ledger.map((entry) => entry.purchasePrice),
    ledger
      .filter((entry) => entry.settled)
      .map((entry) => entry.salePayout ?? 0),
  );
}
