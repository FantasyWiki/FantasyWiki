import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import api from "@/services/api";

export function useLeaguePerformances(limit = 10) {
  const leagueStore = useLeagueStore();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: computed(() => [
      "league-performances",
      leagueStore.currentLeagueId,
      limit,
    ]),
    queryFn: () =>
      api.leagues.getPerformances(leagueStore.currentLeague!.id, limit),
    enabled: computed(() => !!leagueStore.currentLeagueId),
  });

  // Classifica ordinata per punti decrescenti
  const pastLeaderboard = computed(() =>
    [...(data.value ?? [])].sort((a, b) => b.points - a.points)
  );

  return { pastLeaderboard, isLoading, isError, error, refetch };
}
