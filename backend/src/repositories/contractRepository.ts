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
   * Creates a contract and debits the purchase price from the owning team's
   * credits as a single atomic write. Fails (without creating the contract)
   * if the team no longer has enough credits at write time.
   */
  create(newContract: NewContract): Promise<Result<Contract>>;
}
