import { defineStore } from "pinia";
import { computed, ref } from "vue";
import api from "@/services/api";
import { LeagueDTO } from "../../../dto/leagueDTO";
import { Temporal } from "@js-temporal/polyfill";
import Now = Temporal.Now;

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
  const emptyLeague = (): LeagueDTO => ({
    id: "",
    title: "No League Selected",
    description: "",
    domain: "en",
    icon: "",
    startDate: Now.instant(),
    endDate: Now.instant(),
    teams: [],
  });
  const currentLeague = ref<LeagueDTO>();
  const availableLeagues = ref<LeagueDTO[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // ── Getters ────────────────────────────────────────────────────────────────

  const currentLeagueId = computed(() => currentLeague.value?.id ?? null);

  const currentLeagueName = computed(
    () => currentLeague.value?.title ?? "No League Selected"
  );

  // ── Helpers ────────────────────────────────────────────────────────────────


  /**
   * Validate `currentLeague` against the fetched `availableLeagues` list.
   * If the stored league id is not found (e.g. stale localStorage entry),
   * fall back to the first available league and persist the correction.
   * Returns the resolved league so callers can act on it immediately.
   */
  function _resolveCurrentLeague(): LeagueDTO {
    if (!availableLeagues.value.length) return emptyLeague();

    const candidate = currentLeague.value;
    const found = candidate
      ? (availableLeagues.value.find((l) => l.id === candidate.id) ?? null)
      : null;

    const resolved = found ?? availableLeagues.value[0];

    if (resolved.id !== candidate?.id) {
      // The stored league was absent or stale — correct and persist.
      currentLeague.value = resolved;
      localStorage.setItem("currentLeague", JSON.stringify(resolved));
    }

    return resolved;
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Fetch the list of available leagues from the API.
   * Always validates the current selection against the fresh list and falls
   * back to the first league when the stored id is not found.
   */
  async function fetchLeagues() {
    isLoading.value = true;
    error.value = null;
    try {
      availableLeagues.value = await api.leagues.getAll();
      _resolveCurrentLeague();
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
  function setCurrentLeague(league: LeagueDTO) {
    currentLeague.value = league;
    localStorage.setItem("currentLeague", JSON.stringify(league));
  }

  /**
   * Bootstrap: restore persisted league then fetch and validate the full list.
   * Called once from NavBar on mount.
   *
   * Order of operations:
   *  1. Optimistically restore from localStorage so the UI has something to
   *     show immediately (avoids a blank league selector on first paint).
   *  2. Fetch the authoritative list from the API.
   *  3. `fetchLeagues` calls `_resolveCurrentLeague`, which validates the
   *     optimistic value against the real list and corrects it if stale.
   */
  async function initialize() {
    const saved = localStorage.getItem("currentLeague");
    if (saved) {
      try {
        // Optimistic restore — may be stale; will be validated after fetch.
        currentLeague.value = JSON.parse(saved) as LeagueDTO;
      } catch {
        // Corrupt localStorage entry — ignore; fetchLeagues will set a default.
        localStorage.removeItem("currentLeague");
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
