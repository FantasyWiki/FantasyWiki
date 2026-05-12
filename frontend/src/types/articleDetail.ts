import { Temporal } from "@js-temporal/polyfill";
import type { ArticleDTO } from "../../../dto/articleDTO";

export type ArticleAvailability =
    | "free-agent"
    | "owned-by-viewer"
    | "owned-by-other";

export type ArticleDetailInput = {
    article: ArticleDTO;
    currentPrice: number;
    purchasePrice?: number;
    expiresIn?: Temporal.Duration;
    tier?: string;
    ownerTeamId?: string;
    ownerTeamName?: string;
    viewerTeamId?: string;
    viewerCredits?: number;
};

export type ArticleDetail = {
    article: ArticleDTO;
    currentPrice: number;
    purchasePrice?: number;
    expiresIn?: Temporal.Duration;
    tier?: string;
    availability: ArticleAvailability;
    ownerTeamName?: string;
    showBuy: boolean;
    buyDisabled: boolean;
    buyDisabledReason?: string;
    showContractActions: boolean;
};

export function buildArticleDetail(
    input: ArticleDetailInput
): ArticleDetail {
    const availability = resolveAvailability(
        input.ownerTeamId,
        input.viewerTeamId
    );
    const hasEnoughCredits = (input.viewerCredits ?? 0) >= input.currentPrice;
    const buyDisabledReason =
        availability !== "free-agent"
            ? "Already owned"
            : hasEnoughCredits
                ? undefined
                : "Not enough credits";

    return {
        article: input.article,
        currentPrice: input.currentPrice,
        purchasePrice: input.purchasePrice,
        expiresIn: input.expiresIn,
        tier: input.tier,
        availability,
        ownerTeamName: input.ownerTeamName,
        showBuy: availability !== "owned-by-viewer",
        buyDisabled: buyDisabledReason !== undefined,
        buyDisabledReason,
        showContractActions: availability === "owned-by-viewer",
    };
}

function resolveAvailability(
    ownerTeamId?: string,
    viewerTeamId?: string
): ArticleAvailability {
    if (!ownerTeamId) return "free-agent";
    if (viewerTeamId && ownerTeamId === viewerTeamId) return "owned-by-viewer";
    return "owned-by-other";
}
