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

export interface ContractRepository {
  getByTeamId(teamId: string): Promise<Result<Contract[]>>;
  getById(id: string): Promise<Result<Contract | null>>;
  /** All contracts held by any team within the given league. */
  getByLeagueId(leagueId: string): Promise<Result<LeagueContractRow[]>>;
  /**
   * Creates a contract in a single guarded write: the INSERT only applies if
   * the owning team's derived credits (STARTING_CREDITS - sum(purchasePrice)
   * + sum(salePayout of settled contracts)) can still cover the price at
   * write time — naturally atomic (SQLite/D1 guarantee single-statement
   * atomicity against concurrent writers), no debit step needed since
   * credits are never stored. Fails if the team no longer has enough
   * (derived) credits at write time.
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
}
