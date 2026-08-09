import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { queryKeys } from "@/composables/queryKeys";
import api from "@/services/api";
import type { LeagueDTO } from "../../../dto/leagueDTO";

const EMPTY: LeagueDTO[] = [];

/**
 * Public leagues anyone can join.
 *
 * The same answer for every player — which is why it is a plain query with no
 * league or player in its key, and why it can sit in cache for a while: a
 * league's existence is not news that goes stale in seconds.
 *
 * Whose leagues these are *not* is decided by the caller. This composable
 * deliberately does not subtract the player's own: the store that knows which
 * those are is a different source, and folding it in here would make a shared,
 * cacheable list quietly per-player.
 */
export function usePublicLeagues() {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.publicLeagues(),
    queryFn: () => api.leagues.getPublic(),
    staleTime: 5 * 60 * 1000,
  });

  return {
    publicLeagues: computed(() => data.value ?? EMPTY),
    isLoading,
    isError,
  };
}
