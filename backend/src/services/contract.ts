import { Temporal } from "@js-temporal/polyfill";
import { Domain } from "../../../model/enums";
import { RawContract } from "../../../dto/contractDTO";
import {
  ContractTier,
  TIER_DAYS,
  computeContractPrice,
  normalizedViews,
  resolveLanguageScale,
} from "../../../model/pricing";
import { ContractRepository } from "../repositories/contractRepository";
import { ContractRepositoryD1 } from "../repositories/d1/contractRepositoryD1";
import { LeagueRepository } from "../repositories/leagueRepository";
import { LeagueRepositoryD1 } from "../repositories/d1/leagueRepositoryD1";
import { TeamRepository } from "../repositories/teamRepository";
import { TeamRepositoryD1 } from "../repositories/d1/teamRepositoryD1";
import { PlayerRepository } from "../repositories/playerRepository";
import { PlayerRepositoryD1 } from "../repositories/d1/playerRepositoryD1";
import { Result, success, failure } from "../repositories/result";
import { WikimediaClient } from "../../../external-apis/wikimedia/client";
import { createWikimediaClient } from "./wikimediaClient";
import { toRawContract } from "./rawContract";

export const MAX_TEAM_CONTRACTS = 22;
const VALID_TIERS: ContractTier[] = ["SHORT", "MEDIUM", "LONG"];

function isContractTier(tier: string): tier is ContractTier {
  return (VALID_TIERS as string[]).includes(tier);
}

export class ContractService {
  private contractRepo: ContractRepository;
  private leagueRepo: LeagueRepository;
  private teamRepo: TeamRepository;
  private playerRepo: PlayerRepository;
  private wikimedia: WikimediaClient;

  constructor(
    db: D1Database,
    contractRepo?: ContractRepository,
    leagueRepo?: LeagueRepository,
    teamRepo?: TeamRepository,
    playerRepo?: PlayerRepository,
    wikimedia?: WikimediaClient,
  ) {
    this.contractRepo = contractRepo ?? new ContractRepositoryD1(db);
    this.leagueRepo = leagueRepo ?? new LeagueRepositoryD1(db);
    this.teamRepo = teamRepo ?? new TeamRepositoryD1(db);
    this.playerRepo = playerRepo ?? new PlayerRepositoryD1(db);
    this.wikimedia = wikimedia ?? createWikimediaClient();
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

  /**
   * Buys an article contract for the current player's team in a league.
   * Price is always computed server-side from live Wikimedia views (ADR 0005)
   * — the client only chooses `articleId`/`tier`, never a price. Persistence
   * (contract insert + credit debit) is atomic; see ContractRepository.create.
   */
  async buyContract(
    playerId: string,
    leagueId: string,
    articleId: string,
    tier: string,
  ): Promise<Result<RawContract>> {
    const teamResult = await this.teamRepo.getByPlayerAndLeague(
      playerId,
      leagueId,
    );
    if (!teamResult.ok) {
      return teamResult;
    }
    if (teamResult.value === null) {
      return failure("No team found for this league");
    }
    const team = teamResult.value;

    const leagueResult = await this.leagueRepo.getById(leagueId);
    if (!leagueResult.ok) {
      return leagueResult;
    }
    const domain = leagueResult.value.domain as Domain;

    if (!isContractTier(tier)) {
      return failure("Invalid contract tier");
    }

    const leagueContractsResult =
      await this.contractRepo.getByLeagueId(leagueId);
    if (!leagueContractsResult.ok) {
      return leagueContractsResult;
    }
    const activeLeagueContracts = leagueContractsResult.value.filter(
      (contract) => !contract.settled,
    );

    const ownedByOtherTeam = activeLeagueContracts.some(
      (contract) =>
        contract.articleId === articleId && contract.teamId !== team.id,
    );
    if (ownedByOtherTeam) {
      return failure("Article already owned by another team");
    }

    const activeTeamContracts = activeLeagueContracts.filter(
      (contract) => contract.teamId === team.id,
    );
    if (
      activeTeamContracts.some((contract) => contract.articleId === articleId)
    ) {
      return failure("You already own this article");
    }
    if (activeTeamContracts.length >= MAX_TEAM_CONTRACTS) {
      return failure("Team is full (11 contracts)");
    }

    let price: number;
    try {
      const views = await this.wikimedia.pageviews.getArticleViews(
        domain,
        articleId,
      );
      // Enforce correctness over availability: a failed views fetch leaves
      // `averageViews30d` undefined. Never price that as 0 (which would sell the
      // contract for free and skip the debit) — reject the buy instead. A real
      // sub-2,000-view article still returns a defined number and legitimately
      // prices at 0 (the intended free/broke-player mechanic, ADR 0003).
      if (views.averageViews30d === undefined) {
        return failure(
          "Couldn't fetch this article's views to price the contract. Please try again.",
        );
      }
      price = computeContractPrice(
        normalizedViews(views.averageViews30d, resolveLanguageScale(domain)),
        TIER_DAYS[tier],
      );
    } catch (error) {
      return failure(
        error instanceof Error
          ? error.message
          : "Failed to fetch article views",
      );
    }

    if (price > team.credits) {
      return failure("Not enough credits");
    }

    const purchaseDate = Temporal.Now.plainDateISO();
    const expireDate = purchaseDate.add({ days: TIER_DAYS[tier] });

    const createResult = await this.contractRepo.create({
      teamId: team.id,
      articleId,
      purchaseDate,
      expireDate,
      purchasePrice: price,
    });
    if (!createResult.ok) {
      return createResult;
    }

    const playerResult = await this.playerRepo.getById(playerId);
    if (!playerResult.ok) {
      return playerResult;
    }

    return success(
      toRawContract(
        createResult.value,
        { id: team.id, name: team.name, credits: team.credits - price },
        { id: playerId, name: playerResult.value.username },
        domain,
      ),
    );
  }

  /** Active (non-settled) contracts owned by the current player's team in a league. */
  async getMyContracts(
    playerId: string,
    leagueId: string,
  ): Promise<Result<RawContract[]>> {
    const teamResult = await this.teamRepo.getByPlayerAndLeague(
      playerId,
      leagueId,
    );
    if (!teamResult.ok) {
      return teamResult;
    }
    if (teamResult.value === null) {
      return failure("No team found for this league");
    }
    const team = teamResult.value;

    const [playerResult, leagueResult, contractsResult] = await Promise.all([
      this.playerRepo.getById(playerId),
      this.leagueRepo.getById(leagueId),
      this.contractRepo.getByTeamId(team.id),
    ]);
    if (!playerResult.ok) return playerResult;
    if (!leagueResult.ok) return leagueResult;
    if (!contractsResult.ok) return contractsResult;

    const domain = leagueResult.value.domain as Domain;
    const activeContracts = contractsResult.value.filter(
      (contract) => !contract.settled,
    );

    return success(
      activeContracts.map((contract) =>
        toRawContract(
          contract,
          { id: team.id, name: team.name, credits: team.credits },
          { id: playerId, name: playerResult.value.username },
          domain,
        ),
      ),
    );
  }
}
