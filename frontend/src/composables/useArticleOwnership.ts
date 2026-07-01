import { computed, type ComputedRef, type Ref } from "vue";
import { useLeagueStore } from "@/stores/league";
import { buildArticleDetail, type ArticleDetail } from "@/types/articleDetail";
import type { ArticleDTO } from "../../../dto/articleDTO";
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
 * @param article - The article being viewed.
 * @param contract - The contract on that article within the current league,
 *   or `null` if it's a free agent.
 * @returns `status` (loading/ready/error), the built `detail` (null until
 *   ready), and `retry` to re-fetch the team context after an error.
 */
export function useArticleOwnership(
  article: Ref<ArticleDTO | null>,
  contract: Ref<ContractDTO | null>
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
    if (!article.value) return null;
    return buildArticleDetail({
      article: article.value,
      contract: contract.value,
      viewerTeamId: leagueStore.currentTeamId ?? undefined,
      viewerCredits: leagueStore.currentTeam?.credits ?? 0,
    });
  });

  const retry = () => {
    void leagueStore.fetchCurrentTeamContext();
  };

  return { status, detail, retry };
}
