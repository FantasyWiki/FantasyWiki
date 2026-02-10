// frontend/src/stores/league.ts
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import api from "@/services/api";
import type { League, Notification, Team } from "@/types/models";

/**
 * Store for managing league context and data
 * Handles current league selection and league-related API calls
 */
export const useLeagueStore = defineStore("league", () => {
  // ========== STATE ==========
  const currentLeague = ref<League | null>(null);
  const availableLeagues = ref<League[]>([]);
  const currentTeam = ref<Team | null>(null);
  const notificationsList = ref<Notification[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // ========== GETTERS ==========

  const currentLeagueName = computed(() => {
    return currentLeague.value?.name || "No League Selected";
  });

  const currentLeagueId = computed(() => {
    return currentLeague.value?.id || "null";
  });

  const currentNotifications = computed(() => {
    if (!currentLeague.value) return [];
    return notificationsList.value.filter(
      (notification) => notification.leagueId === currentLeague.value!.id
    );
  });

  const unreadNotifications = computed(() => {
    return currentNotifications.value.filter((n) => !n.read);
  });

  const unreadCount = computed(() => {
    return unreadNotifications.value.length;
  });

  // ========== ACTIONS ==========

  /**
   * Fetch all available leagues from API
   */
  async function fetchLeagues() {
    isLoading.value = true;
    error.value = null;

    try {
      availableLeagues.value = await api.leagues.getAll();

      // If no current league is set, restore from localStorage or use first league
      if (!currentLeague.value && availableLeagues.value.length > 0) {
        const savedLeague = localStorage.getItem("currentLeague");
        if (savedLeague) {
          const parsed = JSON.parse(savedLeague);
          const found = availableLeagues.value.find((l) => l.id === parsed.id);
          if (found) {
            currentLeague.value = found;
          } else {
            currentLeague.value = availableLeagues.value[0];
          }
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
   * Set the current league
   */
  function setCurrentLeague(league: League) {
    currentLeague.value = league;
    localStorage.setItem("currentLeague", JSON.stringify(league));

    // Fetch team and notifications for this league
    // fetchCurrentTeam()
    // fetchNotifications();
  }

  /**
   * Fetch the current player's team for the current league
   */
  async function fetchCurrentTeam() {
    if (!currentLeague.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      currentTeam.value = await api.leagues.getTeam(currentLeague.value.id);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to fetch team";
      console.error("Failed to fetch team:", err);
      currentTeam.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Fetch all notifications for the player
   */
  async function fetchAllNotifications() {
    try {
      notificationsList.value = await api.notifications.getAll();
    } catch (err) {
      console.error("Failed to fetch all notifications:", err);
    }
  }

  /**
   * Mark a notification as read
   */
  /*
  async function markNotificationAsRead(notificationId: string) {
    try {
      const updated = await api.notifications.markAsRead(notificationId);

      // Update local state
      const index = notificationsList.value.findIndex(
        (n) => n.id === notificationId
      );
      if (index !== -1) {
        notificationsList.value[index] = updated;
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }
  */

  /**
   * Clear current league
   */
  /*
  function clearCurrentLeague() {
    currentLeague.value = null;
    currentTeam.value = null;
    localStorage.removeItem("currentLeague");
  }
*/
  /**
   * Initialize the store
   */
  async function initialize() {
    // Try to restore from localStorage
    const savedLeague = localStorage.getItem("currentLeague");
    if (savedLeague) {
      try {
        currentLeague.value = JSON.parse(savedLeague);
      } catch (err) {
        console.error("Failed to restore league from localStorage:", err);
      }
    }

    // Fetch leagues and notifications
    await fetchLeagues();
    await fetchAllNotifications();

    // If we have a current league, fetch its team
    if (currentLeague.value) {
      await fetchCurrentTeam();
    }
  }

  return {
    // State
    currentLeague,
    availableLeagues,
    currentTeam,
    notificationsList,
    isLoading,
    error,

    // Getters
    currentLeagueName,
    currentLeagueId,
    currentNotifications,
    unreadNotifications,
    unreadCount,
    // Actions
    setCurrentLeague,
    fetchAllNotifications,
    initialize,
  };
});
