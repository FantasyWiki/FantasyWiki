// frontend/src/stores/league.ts
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import api from "@/services/api";
import type { League } from "@/types/models";

/**
 * Manages the player's league context.
 *
 * This store holds ONLY shared UI state that multiple unrelated components
 * need to read simultaneously:
 *   - Which league is currently selected (drives all scoped API calls)
 *   - The list of available leagues (needed by NavBar selector + dashboard)
 *
 * Remote data that belongs to a single view (dashboard KPIs, contracts,
 * leaderboard, notifications, trades) is fetched via TanStack Query
 * composables in src/composables/ and does NOT live here.
 */
export const useLeagueStore = defineStore("league", () => {
  // ── State ──────────────────────────────────────────────────────────────────

  const currentLeague = ref<League | null>(null);
  const availableLeagues = ref<League[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // ── Getters ────────────────────────────────────────────────────────────────

  const currentLeagueId = computed(() => currentLeague.value?.id ?? null);

  const currentLeagueName = computed(
    () => currentLeague.value?.name ?? "No League Selected"
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Fetch the list of available leagues from the API.
   * Restores the last selected league from localStorage if still valid.
   * Called once during app initialisation from NavBar.
   */
  async function fetchLeagues() {
    isLoading.value = true;
    error.value = null;
    try {
      availableLeagues.value = await api.leagues.getAll();

      // Restore persisted selection, or fall back to the first league.
      if (!currentLeague.value && availableLeagues.value.length > 0) {
        const saved = localStorage.getItem("currentLeague");
        if (saved) {
          const parsed = JSON.parse(saved) as League;
          const found = availableLeagues.value.find((l) => l.id === parsed.id);
          currentLeague.value = found ?? availableLeagues.value[0];
        } else {
          currentLeague.value = availableLeagues.value[0];
        }
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to fetch leagues";
      console.error("Failed to fetch leagues:", err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Switch the active league.
   * Persists the selection to localStorage so it survives a page refresh.
   * Components that depend on league-scoped data (via useQuery with the
   * leagueId in the query key) will automatically refetch when this changes.
   */
  function setCurrentLeague(league: League) {
    currentLeague.value = league;
    localStorage.setItem("currentLeague", JSON.stringify(league));
  }

  /**
   * Bootstrap: restore persisted league then fetch the full list.
   * Called once from NavBar on mount.
   */
  async function initialize() {
    const saved = localStorage.getItem("currentLeague");
    if (saved) {
      try {
        currentLeague.value = JSON.parse(saved) as League;
      } catch {
        // Corrupt localStorage entry — ignore and let fetchLeagues set it.
      }
    }
    await fetchLeagues();
  }

  return {
    // State
    currentLeague,
    availableLeagues,
    isLoading,
    error,
    // Getters
    currentLeagueId,
    currentLeagueName,
    // Actions
    setCurrentLeague,
    fetchLeagues,
    initialize,
  };
});
