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
import { NotificationRepository } from "../repositories/notificationRepository";
import { NotificationRepositoryD1 } from "../repositories/d1/notificationRepositoryD1";
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
  private notificationRepo: NotificationRepository;

  constructor(
    db: D1Database,
    contractRepo?: ContractRepository,
    leagueRepo?: LeagueRepository,
    teamRepo?: TeamRepository,
    playerRepo?: PlayerRepository,
    wikimedia?: WikimediaClient,
    notificationRepo?: NotificationRepository,
  ) {
    this.contractRepo = contractRepo ?? new ContractRepositoryD1(db);
    this.leagueRepo = leagueRepo ?? new LeagueRepositoryD1(db);
    this.teamRepo = teamRepo ?? new TeamRepositoryD1(db);
    this.playerRepo = playerRepo ?? new PlayerRepositoryD1(db);
    this.wikimedia = wikimedia ?? createWikimediaClient();
    this.notificationRepo =
      notificationRepo ?? new NotificationRepositoryD1(db);
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
   * — the client only chooses `articleId`/`tier`, never a price. Team credits
   * are derived from the contracts ledger (never stored), so the INSERT
   * itself is the single guarded write that decides affordability — see
   * ContractRepository.create.
   */
  async buyContract(
    playerId: string,
    leagueId: string,
    articleId: string,
    tier: string,
  ): Promise<Result<RawContract>> {
    const [teamResult, leagueResult] = await Promise.all([
      this.teamRepo.getByPlayerAndLeague(playerId, leagueId),
      this.leagueRepo.getById(leagueId),
    ]);
    if (!teamResult.ok) {
      return teamResult;
    }
    if (teamResult.value === null) {
      return failure("No team found for this league");
    }
    const team = teamResult.value;

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

    // Fetch the player's display name in parallel with the write rather than
    // up front: on the rejection paths above it's never needed, so this avoids
    // a wasted read on every rejected buy while adding no latency to the happy
    // path. The lookup is deliberately non-fatal — the purchase is authoritative
    // once `create` succeeds, so a failed name read falls back to an empty name
    // (the client refetches) rather than turning a completed buy into an error.
    const [createResult, playerResult] = await Promise.all([
      this.contractRepo.create({
        teamId: team.id,
        articleId,
        purchaseDate,
        expireDate,
        purchasePrice: price,
      }),
      this.playerRepo.getById(playerId),
    ]);
    if (!createResult.ok) {
      return createResult;
    }

    // Credits are derived as STARTING_CREDITS - Σpurchases + Σpayouts
    // (see TeamRepository.getByPlayerAndLeague), so the post-purchase value
    // is just team.credits - price — no re-fetch needed, and nothing after
    // the write can turn an already-successful purchase into an error.
    return success(
      toRawContract(
        createResult.value,
        { id: team.id, name: team.name, credits: team.credits - price },
        {
          id: playerId,
          name: playerResult.ok ? playerResult.value.username : "",
        },
        domain,
      ),
    );
  }

  /**
   * Sells one of the current player's contracts before its term ends for a
   * prorated payout (the story's "sell early" flow). Price is always recomputed
   * server-side from live Wikimedia views (ADR 0005), fed the contract's *own*
   * held tier length — never a fixed tier — so the proration is against the
   * value actually bought:
   *
   *   payout = max(0, ContractPrice(liveViews, tierDays) × remainingDays / tierDays)
   *
   * The contract row is retained (`settled=1`), never deleted, so the sale
   * notification's `contractId` FK stays valid. `settleSale` is a single
   * guarded write (flips settled + persists the payout) — team credits are
   * derived from this same ledger, so there's no separate credit write to
   * keep in sync. The follow-up notification write is a simple, low-stakes
   * next step: money correctness never depends on it.
   */
  async sellContract(
    playerId: string,
    leagueId: string,
    contractId: string,
  ): Promise<Result<RawContract>> {
    const [teamResult, leagueResult, contractResult] = await Promise.all([
      this.teamRepo.getByPlayerAndLeague(playerId, leagueId),
      this.leagueRepo.getById(leagueId),
      this.contractRepo.getById(contractId),
    ]);
    if (!teamResult.ok) {
      return teamResult;
    }
    if (teamResult.value === null) {
      return failure("No team found for this league");
    }
    const team = teamResult.value;

    if (!leagueResult.ok) {
      return leagueResult;
    }
    const domain = leagueResult.value.domain as Domain;

    if (!contractResult.ok) {
      return contractResult;
    }
    const contract = contractResult.value;
    if (contract === null) {
      return failure("Contract not found");
    }
    if (contract.teamId !== team.id) {
      return failure("You do not own this contract");
    }
    if (contract.settled) {
      return failure("Contract already sold");
    }

    // Tier length is the contract's own held duration; remaining is measured
    // from today to expiry. today >= purchaseDate always, so the ratio never
    // exceeds 1 — the formula only floors at 0 (a past-expiry contract).
    const tierDays = contract.purchaseDate.until(contract.expireDate).days;
    const today = Temporal.Now.plainDateISO();
    const remainingDays = today.until(contract.expireDate).days;

    let price: number;
    try {
      const views = await this.wikimedia.pageviews.getArticleViews(
        domain,
        contract.articleId,
      );
      // Same correctness-over-availability stance as buyContract: a failed
      // views fetch leaves `averageViews30d` undefined; never price that as 0
      // (which would hand out a free settlement). Reject the sale instead.
      if (views.averageViews30d === undefined) {
        return failure(
          "Couldn't fetch this article's views to price the sale. Please try again.",
        );
      }
      price = computeContractPrice(
        normalizedViews(views.averageViews30d, resolveLanguageScale(domain)),
        tierDays,
      );
    } catch (error) {
      return failure(
        error instanceof Error
          ? error.message
          : "Failed to fetch article views",
      );
    }

    const proratedRatio = tierDays > 0 ? remainingDays / tierDays : 0;
    const payout = Math.max(0, Math.round(price * proratedRatio));

    const articleTitle = contract.articleId.replace(/_/g, " ");
    const message = `Sold ${articleTitle} early for ${payout} credits`;

    // Fetch the player's display name in parallel with the settlement write
    // rather than up front: the rejection paths above never need it, so this
    // avoids a wasted read on every rejected sale while adding no latency. The
    // lookup is non-fatal — once `settleSale` wins, the sale is authoritative,
    // so a failed name read falls back to an empty name (the client refetches)
    // rather than turning a completed sale into an error.
    const [saleResult, playerResult] = await Promise.all([
      this.contractRepo.settleSale(contract.id, team.id, payout),
      this.playerRepo.getById(playerId),
    ]);
    if (!saleResult.ok) {
      return saleResult;
    }
    if (!saleResult.value) {
      return failure("Contract already sold");
    }

    // Best-effort: the sale is already settled above, so a failure here must
    // not turn a successful sale into an error response (that would send the
    // client into a retry loop that only ever hits "Contract already sold").
    const notificationResult = await this.notificationRepo.create({
      id: crypto.randomUUID(),
      contractId: contract.id,
      message,
      date: today.toString(),
    });
    if (!notificationResult.ok) {
      console.error(
        `Failed to create sale notification for contract ${contract.id}: ${notificationResult.error}`,
      );
    }

    // Credits are derived as STARTING_CREDITS - Σpurchases + Σpayouts
    // (see TeamRepository.getByPlayerAndLeague), so the post-sale value is
    // just team.credits + payout — no re-fetch needed, and nothing after
    // the write can turn an already-successful sale into an error.
    return success(
      toRawContract(
        { ...contract, settled: true },
        { id: team.id, name: team.name, credits: team.credits + payout },
        {
          id: playerId,
          name: playerResult.ok ? playerResult.value.username : "",
        },
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
