import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import api from "@/services/api";
import type { DashboardData } from "@/types/models";

/**
 * Provides raw dashboard data for the currently active league.
 *
 * This composable is intentionally thin — it fetches and caches the API
 * response and exposes the data as-is. Any derived filtering (e.g. urgent
 * contracts, leaderboard slicing) is the responsibility of the component
 * that needs it, keeping this composable reusable and easy to reason about.
 *
 * The query key contains the leagueId so:
 *   - Each league has its own cache entry.
 *   - Switching leagues triggers a fresh fetch automatically.
 *   - Going back to a previously visited league reuses cached data until stale.
 */
export function useDashboard() {
  const leagueStore = useLeagueStore();

  const { data, isLoading, isError, error, refetch } = useQuery<DashboardData>({
    queryKey: computed(() => ["dashboard", leagueStore.currentLeagueId]),
    queryFn: () => api.dashboard.getData(leagueStore.currentLeagueId!),
    enabled: computed(() => !!leagueStore.currentLeagueId),
  });

  // Expose individual slices with safe defaults so components don't need
  // to null-check data.value everywhere.
  const summary = computed(() => data.value?.summary ?? null);
  const contracts = computed(() => data.value?.contracts ?? []);
  const leaderboard = computed(() => data.value?.leaderboard ?? []);
  const team = computed(() => data.value?.team ?? null);

  return {
    // Query state
    isLoading,
    isError,
    error,
    refetch,
    // Raw data slices — filter in the component that needs it
    summary,
    contracts,
    leaderboard,
    team,
  };
}
