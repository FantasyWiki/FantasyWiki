import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import api from "@/services/api";
import type { TeamDTO } from "../../../dto/teamDTO";

/**
 * Fetches the current player's team in the active league so views can show
 * the real credits balance. Scoped to the selected league and resolved from
 * the session/JWT on the backend (no playerId is sent from the client).
 */
export function useTeamBalance() {
  const leagueStore = useLeagueStore();

  const leagueId = computed(() => leagueStore.currentLeague?.id);

  const { data, isLoading, isError, error, refetch } = useQuery<TeamDTO>({
    queryKey: computed(() => ["my-team", leagueId.value]),
    queryFn: () => api.leagues.getMyTeam(leagueId.value!),
    enabled: computed(() => !!leagueId.value),
  });

  const credits = computed<number | null>(() => data.value?.credits ?? null);

  return {
    team: data,
    credits,
    isLoading,
    isError,
    error,
    refetch,
  };
}
