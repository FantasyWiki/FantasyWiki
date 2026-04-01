import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import api from "@/services/api";
import type { DashboardData } from "@/types/models";

/**
 * Provides raw dashboard data for the currently active league.
 *
 * DashboardData is a class with computed getters (rank, portfolioValue, etc.)
 * — expose those directly instead of re-deriving them here.
 */
export function useDashboard() {
  const leagueStore = useLeagueStore();

  const { data, isLoading, isError, error, refetch } = useQuery<DashboardData>({
    queryKey: computed(() => ["dashboard", leagueStore.currentLeagueId]),
    queryFn: () => api.dashboard.getDashboardData(leagueStore.currentLeague!),
    enabled: computed(() => !!leagueStore.currentLeagueId),
  });

  // Raw slices — safe defaults so components skip null-checks
  const team = computed(() => data.value?.team ?? null);
  const league = computed(() => data.value?.league ?? null);
  const contracts = computed(() => data.value?.contracts ?? []);
  const notifications = computed(() => data.value?.notifications ?? []);

  // Derived from DashboardData class getters
  const rank = computed(() => data.value?.rank ?? null);
  const portfolioValue = computed(() => data.value?.portfolioValue ?? 0);
  const activeContracts = computed(() => data.value?.activeContracts ?? 0);
  const maxContracts = computed(() => data.value?.maxContracts ?? 0);
  const totalPlayers = computed(() => data.value?.totalPLayers ?? 0);

  return {
    // Query state
    isLoading,
    isError,
    error,
    refetch,
    // Raw slices
    team,
    league,
    contracts,
    notifications,
    // Computed from DashboardData getters
    rank,
    portfolioValue,
    activeContracts,
    maxContracts,
    totalPlayers,
  };
}
