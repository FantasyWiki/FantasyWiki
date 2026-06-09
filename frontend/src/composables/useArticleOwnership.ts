import { computed, type ComputedRef, type Ref } from "vue";
import { useLeagueStore } from "@/stores/league";
import { buildArticleDetail, type ArticleDetail } from "@/types/articleDetail";
import type { ContractDTO } from "../../../dto/contractDTO";

export type OwnershipStatus = "loading" | "ready" | "error";

/**
 * Resolves the ownership context needed to show article actions.
 *
 * `buildArticleDetail` is synchronous and assumes the viewer's team context is
 * known, but that context loads asynchronously via the league store. This
 * composable owns that async "wait for team context" state machine and only
 * builds the {@link ArticleDetail} once the context is `ready`, so the
 * component can stay pure presentation.
 *
 * @param selectedContract - The contract whose ownership is being resolved.
 * @returns `status` (loading/ready/error), the built `detail` (null until
 *   ready), and `retry` to re-fetch the team context after an error.
 */
export function useArticleOwnership(
  selectedContract: Ref<ContractDTO | null>
): {
  status: ComputedRef<OwnershipStatus>;
  detail: ComputedRef<ArticleDetail | null>;
  retry: () => void;
} {
  const leagueStore = useLeagueStore();

  const status = computed<OwnershipStatus>(() => {
    if (leagueStore.isTeamLoading) return "loading";
    if (leagueStore.teamError) return "error";
    if (!leagueStore.currentTeamId) return "loading";
    return "ready";
  });

  const detail = computed<ArticleDetail | null>(() => {
    if (status.value !== "ready") return null;
    const contract = selectedContract.value;
    if (!contract) return null;
    return buildArticleDetail({
      article: contract.article,
      currentPrice: contract.currentPrice,
      purchasePrice: contract.purchasePrice,
      expiresIn: contract.expiresIn,
      tier: contract.tier,
      ownerTeamId: contract.team.id,
      ownerTeamName: contract.team.name,
      viewerTeamId: leagueStore.currentTeamId ?? undefined,
      viewerCredits: leagueStore.currentTeam?.credits,
    });
  });

  const retry = () => {
    void leagueStore.fetchCurrentTeamContext();
  };

  return { status, detail, retry };
}
