import { useQueryClient } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { useToast } from "@/composables/useToast";
import { queryKeys } from "@/composables/queryKeys";
import { leaguesApi } from "@/services/api";

/**
 * Shared "elect renewal" action, used by both the market's ArticleDetail modal
 * and the dashboard's Needed-Attention list. Elects renewal for a contract,
 * shows a toast, and refreshes every view the change touches (the player's
 * team, market ownership badges, bench, dashboard, inbox) — the same
 * invalidation set as the sell flow, since renewal likewise writes a
 * notification and shifts derived credits/holdings.
 */
export function useRenewContract() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { t } = useI18n();

  /** Returns true on success, false if the request failed (a toast is shown either way). */
  async function renewContract(
    leagueId: string,
    contractId: string
  ): Promise<boolean> {
    try {
      await leaguesApi.renewMyContract(leagueId, contractId);
      showSuccess(t("market.renewSuccess"));
      await Promise.all([
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
      return true;
    } catch (e) {
      showError(e instanceof Error ? e.message : t("market.renewError"));
      return false;
    }
  }

  return { renewContract };
}
