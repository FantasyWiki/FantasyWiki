import { Temporal } from "@js-temporal/polyfill";
import type { ArticleDTO } from "../../../dto/articleDTO";
import type { ContractDTO } from "../../../dto/contractDTO";

export type ArticleAvailability =
  | "free-agent"
  | "owned-by-viewer"
  | "owned-by-other";

export type ContractTier = "SHORT" | "MEDIUM" | "LONG";

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
};

/**
 * STUB: real per-tier pricing (docs/scoring-system.md:
 * ContractPrice = Normalized_30dAvg_Views / 1000 × contract_weeks) is
 * deferred to a later change. Only the {tier, price} shape is final.
 */
export function buildStubTierOptions(): TierPriceOption[] {
  return [
    { tier: "SHORT", price: 100 },
    { tier: "MEDIUM", price: 200 },
    { tier: "LONG", price: 350 },
  ];
}

/**
 * STUB: a free/other article has no contract to read a price from yet, so
 * this stands in for "current market value" until the real price calculator
 * lands — deliberately reuses the MEDIUM tier stub so the two stay in sync.
 */
export function buildStubCurrentPrice(): number {
  return buildStubTierOptions().find((o) => o.tier === "MEDIUM")!.price;
}

export function buildArticleDetail(input: ArticleDetailInput): ArticleDetail {
  const { article, contract, viewerTeamId, viewerCredits } = input;

  if (!contract) {
    return {
      availability: "free-agent",
      article,
      currentPrice: buildStubCurrentPrice(),
      tierOptions: buildStubTierOptions(),
      viewerCredits,
    };
  }

  const tier = contract.tier as ContractTier;
  const ownerTeamName = contract.team.name;

  if (viewerTeamId && contract.team.id === viewerTeamId) {
    return {
      availability: "owned-by-viewer",
      article,
      contractId: contract.id,
      tier,
      expiresIn: contract.expiresIn,
      ownerTeamName,
      currentPrice: contract.currentPrice,
      purchasePrice: contract.purchasePrice,
    };
  }

  return {
    availability: "owned-by-other",
    article,
    contractId: contract.id,
    tier,
    unlockIn: contract.expiresIn,
    ownerTeamName,
    currentPrice: buildStubCurrentPrice(),
  };
}
