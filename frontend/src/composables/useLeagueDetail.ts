import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import { useLeaderboard } from "@/composables/useLeaderboard";
import { queryKeys } from "@/composables/queryKeys";
import api from "@/services/api";
import type { LeagueDTO } from "../../../dto/leagueDTO";

/**
 * Everything the league page renders about one league: its identity card and
 * its standings, both keyed on the id in the route rather than on the league
 * the player happens to have selected.
 *
 * The league itself is always fetched, but seeded from the store's list when the
 * player is already a member — the overwhelmingly common way in, and a spinner
 * for data the app is already holding reads as a stall.
 */
export function useLeagueDetail(
  leagueId: MaybeRefOrGetter<string | undefined>
) {
  const leagueStore = useLeagueStore();
  const id = computed(() => toValue(leagueId) ?? null);

  const knownLeague = computed<LeagueDTO | undefined>(() =>
    leagueStore.availableLeagues.find((l) => l.id === id.value)
  );

  const {
    data: league,
    isLoading: isLeagueLoading,
    isError,
    error,
    refetch: refetchLeague,
  } = useQuery({
    queryKey: computed(() => queryKeys.league(id.value ?? "")),
    queryFn: () => api.leagues.getById(id.value!),
    enabled: computed(() => !!id.value),
    placeholderData: () => knownLeague.value,
  });

  const {
    leaderboard,
    isLoading: isLeaderboardLoading,
    isError: isLeaderboardError,
    refetch: refetchLeaderboard,
  } = useLeaderboard(id);

  /**
   * Straight off the league, which now reports its own size. It used to be
   * derived from `leaderboard.length`, which meant the factsheet read "0 teams"
   * for as long as the standings took to arrive.
   */
  const teamCount = computed(() => league.value?.teamCount ?? 0);

  return {
    league,
    leaderboard,
    teamCount,
    isLeagueLoading,
    isLeaderboardLoading,
    isLeaderboardError,
    isError,
    error,
    async refetch() {
      await Promise.all([refetchLeague(), refetchLeaderboard()]);
    },
  };
}
