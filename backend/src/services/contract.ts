import { Domain } from "../../../model/enums";
import { RawContract } from "../../../dto/contractDTO";
import { ContractRepository } from "../repositories/contractRepository";
import { ContractRepositoryD1 } from "../repositories/d1/contractRepositoryD1";
import { LeagueRepository } from "../repositories/leagueRepository";
import { LeagueRepositoryD1 } from "../repositories/d1/leagueRepositoryD1";
import { Result, success } from "../repositories/result";
import { toRawContract } from "./rawContract";

export class ContractService {
  private contractRepo: ContractRepository;
  private leagueRepo: LeagueRepository;

  constructor(
    db: D1Database,
    contractRepo?: ContractRepository,
    leagueRepo?: LeagueRepository,
  ) {
    this.contractRepo = contractRepo ?? new ContractRepositoryD1(db);
    this.leagueRepo = leagueRepo ?? new LeagueRepositoryD1(db);
  }

  /**
   * All contracts held by any team within a league, wire-ready. Used by the
   * market view to show which league articles are already under contract —
   * separate from `/my-contracts`, which is scoped to the current player.
   */
  async getLeagueContracts(leagueId: string): Promise<Result<RawContract[]>> {
    const leagueResult = await this.leagueRepo.getById(leagueId);
    if (!leagueResult.ok) {
      return leagueResult;
    }
    const domain = leagueResult.value.domain as Domain;

    const contractsResult = await this.contractRepo.getByLeagueId(leagueId);
    if (!contractsResult.ok) {
      return contractsResult;
    }

    const rawContracts = contractsResult.value.map((row) =>
      toRawContract(
        row,
        { id: row.teamId, name: row.teamName, credits: row.teamCredits },
        { id: row.playerId, name: row.playerName },
        domain,
      ),
    );

    return success(rawContracts);
  }
}
