import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import { queryKeys } from "@/composables/queryKeys";
import api from "@/services/api";

/**
 * Standings for one league.
 *
 * Defaults to the selected league (what the dashboard card wants), but takes an
 * explicit id for the surfaces that name a league in their own URL: the league
 * page can be opened for a league that is not the current selection. The key
 * and the fetch read the same resolved id on purpose — keying on the route
 * league while fetching the selected one would cache the wrong table under the
 * right key, with nothing anywhere to show it.
 */
export function useLeaderboard(
  leagueId?: MaybeRefOrGetter<string | null | undefined>
) {
  const leagueStore = useLeagueStore();

  const resolvedId = computed<string | null>(() =>
    leagueId === undefined
      ? leagueStore.currentLeagueId
      : (toValue(leagueId) ?? null)
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: computed(() => queryKeys.leaderboard(resolvedId.value)),
    queryFn: () => api.leagues.getLeaderboard(resolvedId.value!),
    enabled: computed(() => !!resolvedId.value),
  });

  return {
    leaderboard: computed(() => data.value ?? []),
    isLoading,
    isError,
    error,
    refetch,
  };
}
