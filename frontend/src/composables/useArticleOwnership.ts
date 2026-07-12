import { computed, type ComputedRef, type Ref } from "vue";
import { useMyTeam } from "@/composables/useMyTeam";
import { buildArticleDetail, type ArticleDetail } from "@/types/articleDetail";
import type { ArticleDTO } from "../../../dto/articleDTO";
import type { ContractDTO } from "../../../dto/contractDTO";

export type OwnershipStatus = "loading" | "ready" | "error";

/**
 * Resolves the ownership context needed to show article actions.
 *
 * `buildArticleDetail` is synchronous and assumes the viewer's team context
 * is known, but that context loads asynchronously via the my-team query.
 * This composable maps the query's states onto an ownership status and only
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
  contract: Ref<ContractDTO | null>,
  averageViews30d: Ref<number>
): {
  status: ComputedRef<OwnershipStatus>;
  detail: ComputedRef<ArticleDetail | null>;
  retry: () => void;
} {
  const { myTeam, myTeamId, isPending, error, refetch } = useMyTeam();

  const status = computed<OwnershipStatus>(() => {
    if (isPending.value) return "loading";
    if (error.value) return "error";
    if (!myTeamId.value) return "loading";
    return "ready";
  });

  const detail = computed<ArticleDetail | null>(() => {
    if (status.value !== "ready") return null;
    if (!article.value) return null;
    return buildArticleDetail({
      article: article.value,
      contract: contract.value,
      viewerTeamId: myTeamId.value ?? undefined,
      viewerCredits: myTeam.value?.credits ?? 0,
      averageViews30d: averageViews30d.value,
    });
  });

  const retry = () => {
    void refetch();
  };

  return { status, detail, retry };
}
