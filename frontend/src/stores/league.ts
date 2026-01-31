import { defineStore } from "pinia";
import { computed, ref } from "vue";

interface League {
  id: string;
  name: string;
  icon: string;
  season: string;
}

interface notification {
  id: string;
  leagueId: string;
  message: string;
  read: boolean;
}

//TODO: REMOVE AND ADD ACTUAL LOGIC
const available_leagues: League[] = [
  { id: "global", name: "Global", icon: "🌐", season: "2024" },
  { id: "italy", name: "Italia", icon: "🍕", season: "2024" },
];

const notifications: notification[] = [
  {
    id: "1",
    leagueId: "italy",
    message: "Scambia morti nel 2026",
    read: false,
  },
  { id: "2", leagueId: "italy", message: "Italia League News!", read: false },
  { id: "3", leagueId: "global", message: "Global League Update", read: true },
];

/**
 * Store for managing current league context
 * Used across the app to track which league the user is viewing
 */
export const useLeagueStore = defineStore("league", () => {
  // ========== STATE ==========
  const currentLeague = ref<League>(
    // Try to restore from localStorage
    JSON.parse(<string>localStorage.getItem("currentLeague")) ||
      available_leagues[0]
  );

  const availableLeagues = ref<League[]>(available_leagues);
  const isLoading = ref(false);

  const notificationsList = ref<notification[]>(notifications);

  // ========== GETTERS ==========

  const currentLeagueName = computed(() => {
    return currentLeague.value.name || "No League Selected";
  });

  const currentNotifications = computed(() => {
    return notificationsList.value.filter(
      (notification) => notification.leagueId === currentLeague.value.id
    );
  });

  // ========== ACTIONS ==========
  function setCurrentLeague(league: League) {
    currentLeague.value = league;
    // Persist to localStorage
    localStorage.setItem("currentLeague", JSON.stringify(league));
  }

  function clearCurrentLeague() {
    localStorage.removeItem("currentLeague");
  }

  async function fetchLeagues() {
    isLoading.value = true;
    try {
      // TODO: Replace with your actual API call
      const response = await fetch("/api/leagues");
      availableLeagues.value = await response.json();
    } catch (error) {
      console.error("Failed to fetch leagues:", error);
    } finally {
      isLoading.value = false;
    }
  }

  return {
    // State
    currentLeague,
    availableLeagues,
    notificationsList,
    isLoading,
    // Getters
    currentLeagueName,
    currentNotifications,
    // Actions
    setCurrentLeague,
    clearCurrentLeague,
    fetchLeagues,
  };
});
