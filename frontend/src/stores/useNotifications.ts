import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import api from "@/services/api";
import type { Notification } from "@/types/models";

/**
 * Provides notifications for the current player.
 *
 * Fetches ALL notifications across every league the player belongs to via
 * GET /api/notifications. This is intentional: the NavBar badge must show
 * the combined unread count across all leagues simultaneously.
 *
 * Per-league filtering is done via derived computeds and helper functions
 * so individual components can scope down as needed.
 */
export function useNotifications() {
  const leagueStore = useLeagueStore();

  const { data, isLoading, refetch } = useQuery<Notification[]>({
    // This query is not league-scoped — it is always the full list.
    // It re-fetches when the window regains focus (TanStack Query default)
    // which keeps the badge count fresh after the user navigates away.
    queryKey: ["notifications"],
    queryFn: () => api.notifications.getAll(),
    placeholderData: [],
    // placeholderData (not initialData) — shows [] while loading but
    // still triggers the fetch immediately. initialData would mark the
    // query as already-fresh and potentially skip the network call entirely.
  });

  const allNotifications = computed(() => data.value ?? []);

  // ── Global (all leagues) ───────────────────────────────────────────────────

  /**
   * Total unread count across every league.
   * This is what the NavBar badge displays.
   */
  const unreadCount = computed(
    () => allNotifications.value.filter((n) => !n.read).length
  );

  // ── Current league ─────────────────────────────────────────────────────────

  /**
   * Notifications scoped to the currently active league.
   * Used by components that only care about the current context.
   */
  const currentLeagueNotifications = computed(() => {
    if (!leagueStore.currentLeagueId) return [];
    return allNotifications.value.filter(
      (n) => n.leagueId === leagueStore.currentLeagueId
    );
  });

  /**
   * Check whether a specific contract has a linked trade-offer notification
   * in the current league. Used by NeededAttention to show the "Trade Offer"
   * chip on a contract row.
   */
  function hasTradeOffer(contractId: string): boolean {
    return currentLeagueNotifications.value.some(
      (n) => n.type === "trade_offer" && n.extra === contractId
    );
  }

  /**
   * Unread count for the currently active league only.
   * Used by DashboardHero bell badge.
   */
  const currentLeagueUnreadCount = computed(
    () => currentLeagueNotifications.value.filter((n) => !n.read).length
  );

  /**
   * Map of leagueId → unread count, derived from the single global fetch.
   * Used by NavBar to show a per-league badge on each dropdown item.
   */
  const unreadCountByLeague = computed(() => {
    const map: Record<string, number> = {};
    allNotifications.value.forEach((n) => {
      if (!n.read) {
        map[n.leagueId] = (map[n.leagueId] ?? 0) + 1;
      }
    });
    return map;
  });

  return {
    allNotifications,
    currentLeagueNotifications,
    isLoading,
    refetch,
    // Global total — NavBar selector button badge
    unreadCount,
    // Current league only — DashboardHero bell badge
    currentLeagueUnreadCount,
    // Per-league map — NavBar dropdown item badges
    unreadCountByLeague,
    // Per-league helper
    hasTradeOffer,
  };
}
