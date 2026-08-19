import { Temporal } from "@js-temporal/polyfill";
import { Domain } from "../../../model/enums";
import { RawContract } from "../../../dto/contractDTO";
import {
  ContractTier,
  TIER_DAYS,
  computeContractPrice,
  computeCurrentPrice,
  normalizedViews,
} from "../../../model/pricing";
import { normalizeLanguageScale } from "../../../model/languageScale";
import {
  type Contract,
  RENEWAL_PREMIUM_RATE,
  articleAvailability,
  earlySellPayout,
  isExpired,
  isRenewalWindowOpen,
  renewalIncrementalCost,
  renewalPremium,
  renewalPrice,
  settlementDelta,
  termDays,
} from "../../../model/contract";
import { type Team, MAX_TEAM_CONTRACTS } from "../../../model/team";
import type { Player } from "../../../model/player";
import {
  ContractRepository,
  CONTRACT_WRITE_ERRORS,
  DueContract,
  LeagueContractRow,
} from "../repositories/contractRepository";
import { LeagueRepository } from "../repositories/leagueRepository";
import { TEAM_ERRORS, TeamRepository } from "../repositories/teamRepository";
import { PlayerRepository } from "../repositories/playerRepository";
import { NotificationRepository } from "../repositories/notificationRepository";
import { Result, success, failure } from "../repositories/result";
import { WikimediaClient } from "../../../external-apis/wikimedia/client";
import { toRawContract } from "./rawContract";

// Re-exported for callers; both live in model/ so the repository layer can
// enforce them too.
export { MAX_TEAM_CONTRACTS, RENEWAL_PREMIUM_RATE };

/**
 * Every business failure buy/sell/renew can produce. Routes map these to HTTP
 * statuses by identity (`contractErrorStatus` in routes/leagues.ts), so the
 * wording is free to change; anything else a route receives is infrastructure
 * failure, not client error.
 */
export const CONTRACT_ERRORS = {
  NO_TEAM: TEAM_ERRORS.NO_TEAM_IN_LEAGUE,
  INVALID_TIER: "Invalid contract tier",
  ARTICLE_TAKEN: "Article already owned by another team",
  ALREADY_OWNED: "You already own this article",
  TEAM_FULL: `Team is full (${MAX_TEAM_CONTRACTS} contracts)`,
  NOT_ENOUGH_CREDITS: "Not enough credits",
  CONTRACT_NOT_FOUND: "Contract not found",
  NOT_CONTRACT_OWNER: "You do not own this contract",
  ALREADY_SOLD: "Contract already sold",
  ALREADY_SETTLED: "Contract already settled",
  EXPIRED: "Contract has already expired",
  RENEWAL_WINDOW_CLOSED:
    "Renewal can only be elected in the final 24 hours before expiry",
  RENEWAL_NOT_ELECTED: "No renewal is elected for this contract",
} as const;

export type ContractError =
  (typeof CONTRACT_ERRORS)[keyof typeof CONTRACT_ERRORS];

const VALID_TIERS: ContractTier[] = ["SHORT", "MEDIUM", "LONG"];

/**
 * Display name for a response body. The lookup is non-fatal: once the guarded
 * write has won the operation is authoritative, so a failed name read falls
 * back to "" (the client refetches) rather than failing the whole operation.
 */
function displayName(playerResult: Result<Player>): string {
  return playerResult.ok ? playerResult.value.username : "";
}

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

  constructor(deps: {
    contracts: ContractRepository;
    leagues: LeagueRepository;
    teams: TeamRepository;
    players: PlayerRepository;
    notifications: NotificationRepository;
    wikimedia: WikimediaClient;
  }) {
    this.contractRepo = deps.contracts;
    this.leagueRepo = deps.leagues;
    this.teamRepo = deps.teams;
    this.playerRepo = deps.players;
    this.notificationRepo = deps.notifications;
    this.wikimedia = deps.wikimedia;
  }

  /**
   * All contracts held by any team in a league — the market view's "already
   * taken" list. Separate from `/my-contracts`, which is player-scoped.
   */
  async getLeagueContracts(leagueId: string): Promise<Result<RawContract[]>> {
    const leagueResult = await this.leagueRepo.getById(leagueId);
    if (!leagueResult.ok) {
      return leagueResult;
    }
    const domain = leagueResult.value.domain;

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
   * Buys an article contract. The client chooses `articleId`/`tier`, never a
   * price. Affordability is decided by the guarded INSERT, not here (ADR 0007).
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
      return failure(CONTRACT_ERRORS.NO_TEAM);
    }
    const team = teamResult.value;

    if (!leagueResult.ok) {
      return leagueResult;
    }
    const domain = leagueResult.value.domain;
    // The league's frozen factor, not a lookup: this price is what the player
    // pays, and it has to be the one the league has always used (ADR 0002).
    // Guarded on the way in, because an unusable value would multiply out to NaN
    // and `computeContractPrice` would floor that to a free contract.
    const languageScale = normalizeLanguageScale(
      leagueResult.value.languageScale,
    );

    if (!isContractTier(tier)) {
      return failure(CONTRACT_ERRORS.INVALID_TIER);
    }

    const leagueContractsResult =
      await this.contractRepo.getByLeagueId(leagueId);
    if (!leagueContractsResult.ok) {
      return leagueContractsResult;
    }

    const rejection = ContractService.purchaseRejection(
      leagueContractsResult.value,
      team.id,
      articleId,
    );
    if (rejection) {
      return failure(rejection);
    }

    const priceResult = await this.priceFromLiveViews(
      domain,
      languageScale,
      articleId,
      TIER_DAYS[tier],
      "Couldn't fetch this article's views to price the contract. Please try again.",
    );
    if (!priceResult.ok) {
      return priceResult;
    }
    const price = priceResult.value;

    if (price > team.credits) {
      return failure(CONTRACT_ERRORS.NOT_ENOUGH_CREDITS);
    }

    const purchaseDate = Temporal.Now.plainDateISO();
    const expireDate = purchaseDate.add({ days: TIER_DAYS[tier] });

    // Name fetched alongside the write, not before it: the rejection paths
    // above never need it. See displayName for why it's non-fatal.
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
      if (createResult.error !== CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT) {
        return createResult;
      }
      return failure(
        await this.classifyPurchaseConflict(team.id, leagueId, articleId),
      );
    }

    // Point-in-time snapshot, not a re-read: nothing after a successful write
    // may turn it into an error. Next team read is authoritative.
    return success(
      toRawContract(
        createResult.value,
        { id: team.id, name: team.name, credits: team.credits - price },
        {
          id: playerId,
          name: displayName(playerResult),
        },
        domain,
      ),
    );
  }

  /**
   * ContractPrice (ADR 0005) from live views. Correctness over availability: a
   * failed fetch leaves `averageViews30d` undefined and pricing that as 0 would
   * give away a free contract, so it rejects instead. A real sub-2,000-view
   * article returns a defined number and legitimately prices at 0 (ADR 0003).
   *
   * `languageScale` is passed in — the league's own frozen factor — rather than
   * looked up from `domain`. The league is the thing that decides what an
   * article's views are worth, and a lookup here would price a contract at
   * whatever the table currently says instead of at what the league was founded
   * on (ADR 0002).
   */
  private async priceFromLiveViews(
    domain: Domain,
    languageScale: number,
    articleId: string,
    days: number,
    unavailableMessage: string,
  ): Promise<Result<number>> {
    try {
      const views = await this.wikimedia.pageviews.getArticleViews(
        domain,
        articleId,
      );
      if (views.averageViews30d === undefined) {
        return failure(unavailableMessage);
      }
      return success(
        computeContractPrice(
          normalizedViews(views.averageViews30d, languageScale),
          days,
        ),
      );
    } catch (error) {
      return failure(
        error instanceof Error
          ? error.message
          : "Failed to fetch article views",
      );
    }
  }

  /**
   * Shared preamble for sell/elect/cancel: load team, league and contract in
   * parallel, then apply the access rules in the order routes expect — team
   * exists, contract exists, caller owns it, still unsettled. `settledError`
   * varies (ALREADY_SOLD for a sale, ALREADY_SETTLED for the renewal paths).
   */
  private async loadOwnedContract(
    playerId: string,
    leagueId: string,
    contractId: string,
    settledError: ContractError,
  ): Promise<
    Result<{
      team: Team;
      domain: Domain;
      languageScale: number;
      contract: Contract;
    }>
  > {
    const [teamResult, leagueResult, contractResult] = await Promise.all([
      this.teamRepo.getByPlayerAndLeague(playerId, leagueId),
      this.leagueRepo.getById(leagueId),
      this.contractRepo.getById(contractId),
    ]);
    if (!teamResult.ok) {
      return teamResult;
    }
    if (teamResult.value === null) {
      return failure(CONTRACT_ERRORS.NO_TEAM);
    }
    if (!leagueResult.ok) {
      return leagueResult;
    }
    if (!contractResult.ok) {
      return contractResult;
    }

    const team = teamResult.value;
    const contract = contractResult.value;
    if (contract === null) {
      return failure(CONTRACT_ERRORS.CONTRACT_NOT_FOUND);
    }
    if (contract.teamId !== team.id) {
      return failure(CONTRACT_ERRORS.NOT_CONTRACT_OWNER);
    }
    if (contract.settled) {
      return failure(settledError);
    }

    return success({
      team,
      domain: leagueResult.value.domain,
      languageScale: normalizeLanguageScale(leagueResult.value.languageScale),
      contract,
    });
  }

  /**
   * Names the ownership rule a purchase would break, or null if admissible.
   * Shared by the pre-write fast-fail and the post-conflict classification so
   * both apply exactly the rules the guarded INSERT enforces.
   */
  private static purchaseRejection(
    leagueContracts: LeagueContractRow[],
    teamId: string,
    articleId: string,
  ): ContractError | null {
    const activeLeagueContracts = leagueContracts.filter(
      (contract) => !contract.settled,
    );

    // Article Availability decides the two ownership rejections, so the buy
    // flow and the market badge answer ownership with the same function.
    const owner = activeLeagueContracts.find(
      (contract) => contract.articleId === articleId,
    );
    switch (articleAvailability(owner?.teamId, teamId)) {
      case "owned-by-other":
        return CONTRACT_ERRORS.ARTICLE_TAKEN;
      case "owned-by-viewer":
        return CONTRACT_ERRORS.ALREADY_OWNED;
      case "free-agent":
        break;
    }

    const activeTeamContracts = activeLeagueContracts.filter(
      (contract) => contract.teamId === teamId,
    );
    if (activeTeamContracts.length >= MAX_TEAM_CONTRACTS) {
      return CONTRACT_ERRORS.TEAM_FULL;
    }
    return null;
  }

  /**
   * The guarded INSERT changed zero rows — a concurrent purchase moved the
   * league under us. Re-read to name the rule that now fails; if every
   * ownership rule still passes, credits is the only guard left.
   */
  private async classifyPurchaseConflict(
    teamId: string,
    leagueId: string,
    articleId: string,
  ): Promise<ContractError | typeof CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT> {
    const contractsResult = await this.contractRepo.getByLeagueId(leagueId);
    if (!contractsResult.ok) {
      return CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT;
    }
    return (
      ContractService.purchaseRejection(
        contractsResult.value,
        teamId,
        articleId,
      ) ?? CONTRACT_ERRORS.NOT_ENOUGH_CREDITS
    );
  }

  /**
   * Early Sell: exits a contract before its term ends for a prorated payout
   * ({@link earlySellPayout}). The row is retained (`settled=1`), never
   * deleted, so the notification's `contractId` FK stays valid.
   */
  async sellContract(
    playerId: string,
    leagueId: string,
    contractId: string,
  ): Promise<Result<RawContract>> {
    const loaded = await this.loadOwnedContract(
      playerId,
      leagueId,
      contractId,
      CONTRACT_ERRORS.ALREADY_SOLD,
    );
    if (!loaded.ok) {
      return loaded;
    }
    const { team, domain, languageScale, contract } = loaded.value;

    // The contract's own held duration, never a fixed tier — otherwise the
    // proration is against value that wasn't bought.
    const tierDays = termDays(contract);
    const today = Temporal.Now.plainDateISO();

    const priceResult = await this.priceFromLiveViews(
      domain,
      languageScale,
      contract.articleId,
      tierDays,
      "Couldn't fetch this article's views to price the sale. Please try again.",
    );
    if (!priceResult.ok) {
      return priceResult;
    }

    const payout = earlySellPayout(contract, priceResult.value, today);

    const articleTitle = contract.articleId.replace(/_/g, " ");
    const message = `Sold ${articleTitle} early for ${payout} credits`;

    const [saleResult, playerResult] = await Promise.all([
      this.contractRepo.settleSale(contract.id, team.id, payout),
      this.playerRepo.getById(playerId),
    ]);
    if (!saleResult.ok) {
      return saleResult;
    }
    if (!saleResult.value) {
      return failure(CONTRACT_ERRORS.ALREADY_SOLD);
    }

    // Best-effort: the sale is already settled, so failing here would send the
    // client into a retry loop that only ever hits "Contract already sold".
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

    // Point-in-time snapshot, as in buyContract.
    return success(
      toRawContract(
        { ...contract, settled: true },
        { id: team.id, name: team.name, credits: team.credits + payout },
        {
          id: playerId,
          name: displayName(playerResult),
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
      return failure(CONTRACT_ERRORS.NO_TEAM);
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

    const domain = leagueResult.value.domain;
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
   * The daily settlement sweep's work list. Passthrough so the Workflow
   * depends only on the service layer.
   */
  async getDueForSettlement(
    today: Temporal.PlainDate,
  ): Promise<Result<DueContract[]>> {
    return this.contractRepo.getDueForSettlement(today);
  }

  /**
   * Records intent to renew at expiry ({@link isRenewalWindowOpen}). Only flips
   * `renewalElected`; the sweep is the single money-writer, so nothing is
   * priced or charged here. Affordability isn't checked — the price isn't known
   * until expiry, and the sweep settles instead if it can't be met.
   */
  async electRenewal(
    playerId: string,
    leagueId: string,
    contractId: string,
  ): Promise<Result<RawContract>> {
    const loaded = await this.loadOwnedContract(
      playerId,
      leagueId,
      contractId,
      CONTRACT_ERRORS.ALREADY_SETTLED,
    );
    if (!loaded.ok) {
      return loaded;
    }
    const { team, domain, contract } = loaded.value;

    const today = Temporal.Now.plainDateISO();
    if (isExpired(contract, today)) {
      return failure(CONTRACT_ERRORS.EXPIRED);
    }
    if (!isRenewalWindowOpen(contract, today)) {
      return failure(CONTRACT_ERRORS.RENEWAL_WINDOW_CLOSED);
    }

    const [electResult, playerResult] = await Promise.all([
      this.contractRepo.electRenewal(contract.id, team.id),
      this.playerRepo.getById(playerId),
    ]);
    if (!electResult.ok) {
      return electResult;
    }
    if (!electResult.value) {
      return failure(CONTRACT_ERRORS.CONTRACT_NOT_FOUND);
    }

    // Election moves no money, so credits are unchanged.
    return success(
      toRawContract(
        { ...contract, renewalElected: true },
        { id: team.id, name: team.name, credits: team.credits },
        {
          id: playerId,
          name: displayName(playerResult),
        },
        domain,
      ),
    );
  }

  /**
   * Withdraws an elected renewal. Guarded on `settled`, not the final-24h
   * window {@link electRenewal} uses: the election is only intent, so it stays
   * reversible until the sweep runs — after which the row is no longer
   * `renewalElected` and this fails with RENEWAL_NOT_ELECTED.
   */
  async cancelRenewal(
    playerId: string,
    leagueId: string,
    contractId: string,
  ): Promise<Result<RawContract>> {
    const loaded = await this.loadOwnedContract(
      playerId,
      leagueId,
      contractId,
      CONTRACT_ERRORS.ALREADY_SETTLED,
    );
    if (!loaded.ok) {
      return loaded;
    }
    const { team, domain, contract } = loaded.value;

    if (!contract.renewalElected) {
      return failure(CONTRACT_ERRORS.RENEWAL_NOT_ELECTED);
    }

    const [cancelResult, playerResult] = await Promise.all([
      this.contractRepo.cancelRenewal(contract.id, team.id),
      this.playerRepo.getById(playerId),
    ]);
    if (!cancelResult.ok) {
      return cancelResult;
    }
    // The row was elected when we read it but is not any more: the settlement
    // sweep renewed it in between, so the intent is no longer withdrawable.
    if (!cancelResult.value) {
      return failure(CONTRACT_ERRORS.RENEWAL_NOT_ELECTED);
    }

    return success(
      toRawContract(
        { ...contract, renewalElected: false },
        { id: team.id, name: team.name, credits: team.credits },
        {
          id: playerId,
          name: displayName(playerResult),
        },
        domain,
      ),
    );
  }

  /**
   * Resolves one due contract (ADR 0003), once per contract from the daily
   * settlement Workflow:
   *
   * - no renewal elected → settle at the full live `currentPrice`;
   * - renewal elected and {@link renewalIncrementalCost} affordable → renew;
   * - elected but unaffordable → settle, with a message saying why.
   *
   * Throws on a failed views fetch or DB write so the Workflow step retries;
   * the guarded writes make a re-run a no-op.
   */
  async settleDueContract(contract: DueContract): Promise<void> {
    const domain = contract.domain;
    const tierDays = termDays(contract);
    const today = Temporal.Now.plainDateISO();
    const articleTitle = contract.articleId.replace(/_/g, " ");

    const views = await this.wikimedia.pageviews.getArticleViews(
      domain,
      contract.articleId,
    );
    // Never settle at 0 on a failed fetch. Throw so the step retries; the
    // contract stays settled=0 and the next sweep re-picks it.
    if (views.averageViews30d === undefined) {
      throw new Error(
        `Couldn't fetch views for ${contract.articleId}; deferring settlement`,
      );
    }
    const currentPrice = computeCurrentPrice(
      views.averageViews30d,
      // The league's frozen factor, carried on the due-contract row by the
      // sweep query — settlement must value a contract at the same scale it was
      // bought at (ADR 0002).
      normalizeLanguageScale(contract.languageScale),
      tierDays,
    );

    if (contract.renewalElected) {
      const premium = renewalPremium(currentPrice, contract.renewalCount);
      const newPurchasePrice = renewalPrice(
        currentPrice,
        contract.renewalCount,
      );
      const incrementalCost = renewalIncrementalCost(
        newPurchasePrice,
        contract.purchasePrice,
      );
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
        // Only notify if this call actually renewed the row.
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

    // Credits the full currentPrice; the delta is only shown as P&L.
    const delta = settlementDelta(contract.purchasePrice, currentPrice);
    const signed = delta >= 0 ? `+${delta}` : `−${Math.abs(delta)}`;
    const settleResult = await this.contractRepo.settleExpiry(
      contract.id,
      currentPrice,
    );
    if (!settleResult.ok) {
      throw new Error(settleResult.error);
    }
    if (settleResult.value) {
      // Still elected here means the renewal was unaffordable.
      const message = contract.renewalElected
        ? `Couldn't renew ${articleTitle} (not enough credits) — settled at expiry: ${signed} credits`
        : `${articleTitle} settled at expiry: ${signed} credits`;
      await this.writeSettlementNotification(contract.id, message, today);
    }
  }

  /**
   * Best-effort, as in sellContract: the money write already succeeded, so a
   * failed notification is logged rather than thrown.
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
