/**
 * `credits` is **derived from the contracts ledger on every read**, never
 * stored — there is no `teams.credits` column and must not be one. The rule is
 * stated once as the `team_credits` view (migration 0006), mirrored below by
 * {@link deriveCredits}, and enforced inside the purchase INSERT rather than
 * the service layer. That last part is load-bearing, not an oversight — read
 * **docs/adr/0007-derived-team-credits.md** before changing anything here.
 */
export interface Team {
  id: string;
  name: string;
  playerId: string;
  leagueId: string;
  credits: number;
}

/**
 * ADR 0003/0005: starting budget for every new team. A view takes no bind
 * parameters, so migration 0006 inlines this as a literal; the two are kept in
 * step by teamCredits.integration.test.ts, which fails if either moves alone.
 */
export const STARTING_CREDITS = 1000;

/** Max active (unsettled) contracts per team, enforced by the same guarded INSERT. */
export const MAX_TEAM_CONTRACTS = 22;

/**
 * What a team may be called. Shared because three places have to agree: the
 * form that types a name, the service that accepts one, and the league-creation
 * payload that names a founding team in the same breath as its league. They
 * each used to state 3 and 30 for themselves.
 */
export const TEAM_NAME_MIN_LENGTH = 3;
export const TEAM_NAME_MAX_LENGTH = 30;

export function isTeamName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return (
    trimmed.length >= TEAM_NAME_MIN_LENGTH &&
    trimmed.length <= TEAM_NAME_MAX_LENGTH
  );
}

/**
 * The credits rule (ADR 0007), stated readably: starting budget, minus every
 * purchase, plus every settled payout. The `team_credits` SQL view is what
 * *enforces* it — affordability must be checked inside the statement that
 * writes the contract — so this documents and tests rather than replaces it.
 * `salePayout` is NULL until settlement, hence the `?? 0`.
 */
export function deriveCredits(
  startingCredits: number,
  contracts: readonly {
    purchasePrice: number;
    settled: boolean;
    salePayout?: number | null;
  }[],
): number {
  return contracts.reduce(
    (credits, contract) =>
      credits -
      contract.purchasePrice +
      (contract.settled ? (contract.salePayout ?? 0) : 0),
    startingCredits,
  );
}