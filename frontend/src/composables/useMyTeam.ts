import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import { queryKeys } from "@/composables/queryKeys";
import api from "@/services/api";
import type { TeamDTO } from "../../../dto/teamDTO";

/**
 * The current player's team in the active league (id, name, credits).
 *
 * This is server state, so it lives in the TanStack Query cache like every
 * other remote resource: the computed key refetches on league switch,
 * concurrent requests dedupe, and mutations that change the team (buying or
 * selling a contract) refresh every consumer by invalidating
 * `queryKeys.myTeam` — no store to keep in sync by hand.
 */
export function useMyTeam() {
  const leagueStore = useLeagueStore();

  const { data, isPending, error, refetch } = useQuery<TeamDTO>({
    queryKey: computed(() => queryKeys.myTeam(leagueStore.currentLeagueId)),
    queryFn: () => api.leagues.getMyTeam(leagueStore.currentLeagueId!),
    enabled: computed(() => !!leagueStore.currentLeagueId),
  });

  return {
    myTeam: computed(() => data.value ?? null),
    myTeamId: computed(() => data.value?.id ?? null),
    isPending,
    error,
    refetch,
  };
}
