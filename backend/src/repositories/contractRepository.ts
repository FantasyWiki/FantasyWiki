import { Temporal } from "@js-temporal/polyfill";
import { Contract } from "../../../model";
import { Result } from "./result";

/**
 * A contract enriched with the team/player fields needed to build a
 * ContractDTO for a league-wide listing, avoiding an N+1 lookup per contract.
 */
export interface LeagueContractRow extends Contract {
  teamName: string;
  teamCredits: number;
  playerId: string;
  playerName: string;
}

export interface NewContract {
  teamId: string;
  articleId: string;
  purchaseDate: Temporal.PlainDate;
  expireDate: Temporal.PlainDate;
  purchasePrice: number;
}

/**
 * An unsettled contract at or past its `expireDate`, enriched with the league
 * `domain` (needed to price its live currentPrice) and the owning team's
 * derived `teamCredits` (needed to decide whether an elected renewal is
 * affordable) — both resolved in the sweep query so the daily settlement
 * job needs no extra per-contract reads.
 */
export interface DueContract extends Contract {
  domain: string;
  teamCredits: number;
}

export const CONTRACT_ERRORS = {
  /**
   * The guarded INSERT rejected the purchase: between the caller's reads and
   * the write, a concurrent purchase broke one of its conditions (article
   * exclusivity, team cap, or derived credits). Callers re-read to tell which.
   */
  PURCHASE_CONFLICT: "Purchase conditions no longer hold",
} as const;

export interface ContractRepository {
  getByTeamId(teamId: string): Promise<Result<Contract[]>>;
  getById(id: string): Promise<Result<Contract | null>>;
  /** All contracts held by any team within the given league. */
  getByLeagueId(leagueId: string): Promise<Result<LeagueContractRow[]>>;
  /**
   * Creates a contract in a single guarded write. The INSERT only applies
   * when, at write time, every purchase condition still holds:
   *  - the owning team's derived credits (STARTING_CREDITS -
   *    sum(purchasePrice) + sum(salePayout of settled contracts)) cover the
   *    price — no debit step needed since credits are never stored;
   *  - no team in the league holds an active contract on the article
   *    (Article Availability exclusivity);
   *  - the team holds fewer than MAX_TEAM_CONTRACTS active contracts.
   * Evaluating the conditions inside the statement makes the check-and-write
   * atomic (SQLite/D1 guarantee single-statement atomicity against concurrent
   * writers), closing the read-then-write race a service-side pre-check alone
   * leaves open. Fails with CONTRACT_ERRORS.PURCHASE_CONFLICT when any
   * condition no longer holds.
   */
  create(newContract: NewContract): Promise<Result<Contract>>;
  /**
   * Settles a contract as an early sale in a single guarded write: flips it
   * to `settled=1` and persists `payout` (the row is retained, never
   * deleted, so the sale notification's `contractId` FK stays valid).
   * Guarded on the contract still being unsettled and owned by `teamId`, so a
   * concurrent double-sell can't succeed twice. Result<boolean>: true iff
   * this call is the one that actually settled it.
   */
  settleSale(
    contractId: string,
    teamId: string,
    payout: number,
  ): Promise<Result<boolean>>;
  /**
   * All unsettled contracts whose `expireDate` is on or before `today`, i.e.
   * the ones the daily settlement sweep must resolve (settle or renew). Uses
   * the `idx_contracts_settled_expire (settled, expireDate)` index and joins in
   * the league domain + derived team credits (see {@link DueContract}).
   */
  getDueForSettlement(
    today: Temporal.PlainDate,
  ): Promise<Result<DueContract[]>>;
  /**
   * Settles a contract at natural expiry ("sold to system", ADR 0003) in a
   * single guarded write: flips it to `settled=1` and persists `payout` (the
   * full live currentPrice) into the same `salePayout` ledger column early
   * sales use. Guarded on the row still being unsettled, so a re-run of the
   * sweep is a no-op. Result<boolean>: true iff this call actually settled it.
   */
  settleExpiry(contractId: string, payout: number): Promise<Result<boolean>>;
  /**
   * Rolls an elected contract's window forward one tier at renewal (ADR 0003):
   * `purchaseDate ← old expireDate`, `expireDate += tierDays`,
   * `purchasePrice ← currentPrice + premium`, `renewalCount++`, and clears
   * `renewalElected`. Guarded on the row being unsettled AND `renewalElected=1`,
   * so a re-run is a no-op (the flag is cleared and the window has moved past
   * `today`). Result<boolean>: true iff this call actually renewed it.
   */
  renew(
    contractId: string,
    newPurchaseDate: Temporal.PlainDate,
    newExpireDate: Temporal.PlainDate,
    newPurchasePrice: number,
  ): Promise<Result<boolean>>;
  /**
   * Records the owner's intent to renew a contract at expiry by setting
   * `renewalElected=1`. Guarded on the row being unsettled and owned by
   * `teamId`. The renewal itself is executed later by the sweep. Result<boolean>:
   * true iff this call flipped the flag.
   */
  electRenewal(contractId: string, teamId: string): Promise<Result<boolean>>;
}
