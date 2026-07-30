import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import { queryKeys } from "@/composables/queryKeys";
import api from "@/services/api";
import type { TeamDTO } from "../../../dto/teamDTO";

/**
 * The current player's team in a league (id, name, credits) — the active league
 * by default, or the one named by the caller, which is how the league page can
 * mark "You" in the standings of a league that is not the current selection.
 * A league the player has no team in resolves to `null` (the endpoint 404s),
 * which is exactly the right answer for a league they are only spectating.
 *
 * This is server state, so it lives in the TanStack Query cache like every
 * other remote resource: the computed key refetches on league switch,
 * concurrent requests dedupe, and mutations that change the team (buying or
 * selling a contract) refresh every consumer by invalidating
 * `queryKeys.myTeam` — no store to keep in sync by hand.
 */
export function useMyTeam(
  leagueId?: MaybeRefOrGetter<string | null | undefined>
) {
  const leagueStore = useLeagueStore();

  const resolvedId = computed<string | null>(() =>
    leagueId === undefined
      ? leagueStore.currentLeagueId
      : (toValue(leagueId) ?? null)
  );

  const { data, isPending, error, refetch } = useQuery<TeamDTO>({
    queryKey: computed(() => queryKeys.myTeam(resolvedId.value)),
    queryFn: () => api.leagues.getMyTeam(resolvedId.value!),
    enabled: computed(() => !!resolvedId.value),
  });

  return {
    myTeam: computed(() => data.value ?? null),
    myTeamId: computed(() => data.value?.id ?? null),
    isPending,
    error,
    refetch,
  };
}
