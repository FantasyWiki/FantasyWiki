import { Temporal } from "@js-temporal/polyfill";
import { Domain } from "../../../model/enums";
import { RawContract } from "../../../dto/contractDTO";
import {
  ContractTier,
  TIER_DAYS,
  computeContractPrice,
  computeCurrentPrice,
  normalizedViews,
  resolveLanguageScale,
} from "../../../model/pricing";
import {
  ContractRepository,
  DueContract,
} from "../repositories/contractRepository";
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
/** ADR 0003: +10% of currentPrice per consecutive renewal (anti-hoard sink). */
export const RENEWAL_PREMIUM_RATE = 0.1;
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
    // the write can turn an already-successful purchase into an error. This is
    // a point-in-time snapshot (pre-write balance minus this purchase); the
    // authoritative balance under concurrency comes from the next team read.
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
    // the write can turn an already-successful sale into an error. This is a
    // point-in-time snapshot (pre-write balance plus this payout); the
    // authoritative balance under concurrency comes from the next team read.
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

  /**
   * All unsettled contracts at or past their `expireDate` — the work list for
   * the daily settlement sweep. Thin passthrough to the repository so the
   * settlement Workflow depends only on the service layer.
   */
  async getDueForSettlement(
    today: Temporal.PlainDate,
  ): Promise<Result<DueContract[]>> {
    return this.contractRepo.getDueForSettlement(today);
  }

  /**
   * Records the current player's intent to renew one of their contracts at
   * expiry (ADR 0003's final-24h right-of-first-refusal). This only flips
   * `renewalElected` — the renewal is executed by the daily settlement sweep,
   * which is the single money-writer, so no price is computed or charged here.
   *
   * The server stores dates only, so the window guard is coarse
   * (`0 <= remainingDays <= 1`); the frontend applies the finer sub-24h gate.
   * Affordability is deliberately not checked here — the price isn't known
   * until expiry — so electing only records intent; the sweep does the
   * authoritative affordability check and settles instead if it can't be met.
   */
  async electRenewal(
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
      return failure("Contract already settled");
    }

    const today = Temporal.Now.plainDateISO();
    const remainingDays = today.until(contract.expireDate).days;
    if (remainingDays < 0) {
      return failure("Contract has already expired");
    }
    if (remainingDays > 1) {
      return failure(
        "Renewal can only be elected in the final 24 hours before expiry",
      );
    }

    const [electResult, playerResult] = await Promise.all([
      this.contractRepo.electRenewal(contract.id, team.id),
      this.playerRepo.getById(playerId),
    ]);
    if (!electResult.ok) {
      return electResult;
    }
    if (!electResult.value) {
      return failure("Contract not found");
    }

    // Election moves no money, so credits are unchanged.
    return success(
      toRawContract(
        { ...contract, renewalElected: true },
        { id: team.id, name: team.name, credits: team.credits },
        {
          id: playerId,
          name: playerResult.ok ? playerResult.value.username : "",
        },
        domain,
      ),
    );
  }

  /**
   * Resolves a single contract that has reached the end of its term (ADR 0003
   * "sold to system" / renewal). Called once per due contract by the daily
   * settlement Workflow, so the durable step is a thin wrapper over this.
   *
   * - No renewal elected → **settle**: credit the full live `currentPrice`
   *   (`settled=1`, payout into the salePayout ledger) and notify with the P&L.
   * - Renewal elected AND affordable → **renew**: roll the window forward a
   *   tier at `currentPrice + premium` and notify. "Affordable" means the
   *   incremental capital `newPurchasePrice − purchasePrice` (the actual ledger
   *   movement, since the old purchasePrice is already sunk) fits in the team's
   *   derived credits.
   * - Renewal elected but unaffordable → **settle instead**, with a message
   *   saying the renewal failed for insufficient credits.
   *
   * Throws on a failed/again-missing views fetch or a DB write error so the
   * Workflow step retries; the guarded writes make a re-run a no-op, so a
   * contract already settled/renewed by a prior run is skipped safely.
   */
  async settleDueContract(contract: DueContract): Promise<void> {
    const domain = contract.domain as Domain;
    const tierDays = contract.purchaseDate.until(contract.expireDate).days;
    const today = Temporal.Now.plainDateISO();
    const articleTitle = contract.articleId.replace(/_/g, " ");

    const views = await this.wikimedia.pageviews.getArticleViews(
      domain,
      contract.articleId,
    );
    // Never settle at 0 on a failed fetch (that would hand out a free/forfeited
    // settlement). Throw so the Workflow step retries; the contract stays
    // settled=0 and is re-picked by the next sweep.
    if (views.averageViews30d === undefined) {
      throw new Error(
        `Couldn't fetch views for ${contract.articleId}; deferring settlement`,
      );
    }
    const currentPrice = computeCurrentPrice(
      views.averageViews30d,
      domain,
      tierDays,
    );

    if (contract.renewalElected) {
      const premium = Math.round(
        currentPrice * RENEWAL_PREMIUM_RATE * contract.renewalCount,
      );
      const newPurchasePrice = currentPrice + premium;
      // Incremental cost is the real balance movement: the old purchasePrice is
      // already sunk in the derived ledger. A drop in currentPrice can make
      // this <= 0, i.e. always affordable.
      const incrementalCost = newPurchasePrice - contract.purchasePrice;
      if (incrementalCost <= contract.teamCredits) {
        const newExpireDate = contract.expireDate.add({ days: tierDays });
        const renewResult = await this.contractRepo.renew(
          contract.id,
          contract.expireDate, // new purchaseDate = old expireDate
          newExpireDate,
          newPurchasePrice,
        );
        if (!renewResult.ok) {
          throw new Error(renewResult.error);
        }
        // Only notify when this call actually renewed the row (a re-run that
        // finds it already renewed is a silent no-op).
        if (renewResult.value) {
          await this.writeSettlementNotification(
            contract.id,
            `Renewed ${articleTitle} for ${tierDays} more days at ${newPurchasePrice} credits (+${premium} premium)`,
            today,
          );
        }
        return;
      }
      // Unaffordable: fall through to settlement below.
    }

    const delta = currentPrice - contract.purchasePrice;
    const signed = delta >= 0 ? `+${delta}` : `−${Math.abs(delta)}`;
    const settleResult = await this.contractRepo.settleExpiry(
      contract.id,
      currentPrice,
    );
    if (!settleResult.ok) {
      throw new Error(settleResult.error);
    }
    if (settleResult.value) {
      // Reaching the settle branch with renewalElected set means the renewal
      // was elected but couldn't be afforded.
      const message = contract.renewalElected
        ? `Couldn't renew ${articleTitle} (not enough credits) — settled at expiry: ${signed} credits`
        : `${articleTitle} settled at expiry: ${signed} credits`;
      await this.writeSettlementNotification(contract.id, message, today);
    }
  }

  /**
   * Best-effort settlement notification: mirrors sellContract's stance — the
   * money write already succeeded, so a failed notification is logged, never
   * thrown (throwing would send the Workflow step into a needless retry that
   * re-does nothing, the settlement being idempotent).
   */
  private async writeSettlementNotification(
    contractId: string,
    message: string,
    today: Temporal.PlainDate,
  ): Promise<void> {
    const result = await this.notificationRepo.create({
      id: crypto.randomUUID(),
      contractId,
      message,
      date: today.toString(),
    });
    if (!result.ok) {
      console.error(
        `Failed to create settlement notification for contract ${contractId}: ${result.error}`,
      );
    }
  }
}
