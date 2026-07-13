import { useQueryClient } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { useToast } from "@/composables/useToast";
import { queryKeys } from "@/composables/queryKeys";
import { leaguesApi } from "@/services/api";
import type { ContractTier } from "@/types/articleDetail";

/**
 * The three contract mutations offered by the article detail modal: buy a free
 * agent, sell early, and elect renewal.
 *
 * They live here rather than in each hosting page because ArticleDetail is
 * mounted from four places (market, team, dashboard team card, dashboard
 * needed-attention list). While every host wired the actions up itself, an
 * unbound emit was a silent no-op — Vue neither warns nor type-errors — so the
 * sell and renew buttons rendered everywhere but only worked in the market.
 * With the mutations owned here and invoked by the modal, a new host gets
 * working actions by construction.
 *
 * All three shift the same derived state, so they share one invalidation set:
 * league contracts (market ownership badges), the team lineup/bench, the
 * dashboard portfolio, my-team (the credits balance pill), and the inbox —
 * each write also posts a notification.
 */
export function useContractActions() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { t } = useI18n();

  function refreshAfterContractChange(leagueId: string) {
    return Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.leagueContracts(leagueId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.teamLineup(leagueId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard(leagueId),
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.myTeam(leagueId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications() }),
    ]);
  }

  /**
   * Returns true on success, false if the request failed (a toast is shown
   * either way). Messages are passed already translated rather than as keys, so
   * that every `t()` call stays a literal the i18n lint rule can account for.
   */
  async function run(
    leagueId: string,
    mutate: () => Promise<unknown>,
    messages: { success: string; error: string }
  ): Promise<boolean> {
    try {
      await mutate();
      showSuccess(messages.success);
      await refreshAfterContractChange(leagueId);
      return true;
    } catch (e) {
      showError(e instanceof Error ? e.message : messages.error);
      return false;
    }
  }

  return {
    buyContract: (leagueId: string, articleId: string, tier: ContractTier) =>
      run(leagueId, () => leaguesApi.buyMyContract(leagueId, articleId, tier), {
        success: t("market.buySuccess"),
        error: t("market.buyError"),
      }),

    sellContract: (leagueId: string, contractId: string) =>
      run(leagueId, () => leaguesApi.sellMyContract(leagueId, contractId), {
        success: t("market.sellSuccess"),
        error: t("market.sellError"),
      }),

    renewContract: (leagueId: string, contractId: string) =>
      run(leagueId, () => leaguesApi.renewMyContract(leagueId, contractId), {
        success: t("market.renewSuccess"),
        error: t("market.renewError"),
      }),

    cancelRenewal: (leagueId: string, contractId: string) =>
      run(
        leagueId,
        () => leaguesApi.cancelRenewMyContract(leagueId, contractId),
        {
          success: t("market.cancelRenewalSuccess"),
          error: t("market.cancelRenewalError"),
        }
      ),
  };
}
