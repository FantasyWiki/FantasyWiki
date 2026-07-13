import { Temporal } from "@js-temporal/polyfill";
import type { ArticleDTO } from "../../../dto/articleDTO";
import type { ContractDTO } from "../../../dto/contractDTO";
import {
  TIER_DAYS,
  computeContractPrice,
  computeCurrentPrice,
  normalizedViews,
  resolveLanguageScale,
  type ContractTier,
} from "../../../model/pricing";

export type { ContractTier };

export type ArticleAvailability =
  | "free-agent"
  | "owned-by-viewer"
  | "owned-by-other";

export type TierPriceOption = {
  tier: ContractTier;
  price: number;
};

interface ArticleDetailBase {
  article: ArticleDTO;
  ownerTeamName?: string;
  /** Always present — the article's live market value, shown regardless of ownership. */
  currentPrice: number;
  /** Only present for owned-by-viewer: what that team actually paid. */
  purchasePrice?: number;
}

export interface FreeAgentDetail extends ArticleDetailBase {
  availability: "free-agent";
  tierOptions: TierPriceOption[];
  viewerCredits: number;
}

export interface OwnedByViewerDetail extends ArticleDetailBase {
  availability: "owned-by-viewer";
  contractId: string;
  tier: ContractTier;
  expiresIn: Temporal.Duration;
  ownerTeamName: string;
  purchasePrice: number;
  /** Consecutive renewals so far — drives the +10%-per-renewal premium. */
  renewalCount: number;
  /** Whether renewal has already been elected for this contract's expiry. */
  renewalElected: boolean;
  /** currentPrice × 0.10 × renewalCount — the anti-hoard premium (ADR 0003). */
  renewalPremium: number;
  /** What renewing would cost: currentPrice + renewalPremium. */
  renewalPrice: number;
}

export interface OwnedByOtherDetail extends ArticleDetailBase {
  availability: "owned-by-other";
  contractId: string;
  tier: ContractTier;
  unlockIn: Temporal.Duration;
  ownerTeamName: string;
}

export type ArticleDetail =
  | FreeAgentDetail
  | OwnedByViewerDetail
  | OwnedByOtherDetail;

export type ArticleDetailInput = {
  article: ArticleDTO;
  contract: ContractDTO | null;
  viewerTeamId?: string;
  viewerCredits: number;
  /** Raw (not normalized) 30-day average views — input to ContractPrice (ADR 0005). */
  averageViews30d: number;
};

function computeTierOptions(
  averageViews30d: number,
  domain: ArticleDTO["domain"]
): TierPriceOption[] {
  const normalized = normalizedViews(
    averageViews30d,
    resolveLanguageScale(domain)
  );
  return (Object.keys(TIER_DAYS) as ContractTier[]).map((tier) => ({
    tier,
    price: computeContractPrice(normalized, TIER_DAYS[tier]),
  }));
}

export function buildArticleDetail(input: ArticleDetailInput): ArticleDetail {
  const { article, contract, viewerTeamId, viewerCredits, averageViews30d } =
    input;

  if (!contract) {
    return {
      availability: "free-agent",
      article,
      currentPrice: computeCurrentPrice(
        averageViews30d,
        article.domain,
        TIER_DAYS.MEDIUM
      ),
      tierOptions: computeTierOptions(averageViews30d, article.domain),
      viewerCredits,
    };
  }

  const tier = contract.tier as ContractTier;
  const currentPrice = computeCurrentPrice(
    averageViews30d,
    article.domain,
    TIER_DAYS[tier]
  );
  const ownerTeamName = contract.team.name;

  if (viewerTeamId && contract.team.id === viewerTeamId) {
    const renewalPremium = Math.round(
      currentPrice * 0.1 * contract.renewalCount
    );
    return {
      availability: "owned-by-viewer",
      article,
      contractId: contract.id,
      tier,
      expiresIn: contract.expiresIn,
      ownerTeamName,
      currentPrice,
      purchasePrice: contract.purchasePrice,
      renewalCount: contract.renewalCount,
      renewalElected: contract.renewalElected,
      renewalPremium,
      renewalPrice: currentPrice + renewalPremium,
    };
  }

  return {
    availability: "owned-by-other",
    article,
    contractId: contract.id,
    tier,
    unlockIn: contract.expiresIn,
    ownerTeamName,
    currentPrice,
  };
}
