import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import api from "@/services/api";

export function useLeaderboard() {
  const leagueStore = useLeagueStore();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: computed(() => ["leaderboard", leagueStore.currentLeagueId]),
    queryFn: () => api.leagues.getLeaderboard(leagueStore.currentLeague!.id),
    enabled: computed(() => !!leagueStore.currentLeagueId),
  });

  return {
    leaderboard: computed(() => data.value ?? []),
    isLoading,
    isError,
    error,
    refetch,
  };
}
