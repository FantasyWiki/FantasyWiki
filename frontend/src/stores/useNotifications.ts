import { computed } from "vue";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import api from "@/services/api";
import { NotificationDTO } from "../../../dto/notificationDTO";

/**
 * Provides notifications for the current player.
 *
 * Fetches ALL notifications across every league via GET /player/notifications.
 * This is intentional: the NavBar badge must show the combined unread count
 * across all leagues simultaneously.
 *
 * Per-league filtering is done via derived computeds so individual components
 * can scope down as needed.
 */
export function useNotifications() {
  const leagueStore = useLeagueStore();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<NotificationDTO[]>({
    queryKey: ["notifications"],
    queryFn: () => api.player.getNotifications(),
    placeholderData: [],
  });

  const allNotifications = computed(() => data.value ?? []);

  // ── Global (all leagues) ─────────────────────────────────────────────────

  const unreadCount = computed(
    () => allNotifications.value.filter((n) => !n.isRead).length
  );

  // ── Current league ───────────────────────────────────────────────────────

  const currentLeagueNotifications = computed(() => {
    if (!leagueStore.currentLeagueId) return [];
    return allNotifications.value.filter(
      (n) => n.leagueId === leagueStore.currentLeagueId
    );
  });

  const currentLeagueUnreadCount = computed(
    () => currentLeagueNotifications.value.filter((n) => !n.isRead).length
  );

  const currentLeagueUnread = computed(() =>
    currentLeagueNotifications.value.filter((n) => !n.isRead)
  );

  // function hasTradeOffer(contractId: string): boolean {
  //   return currentLeagueNotifications.value.some(
  //     (n) => n.type === "trade_offer" && n.extra === contractId
  //   );
  // }

  // ── Per-league map ───────────────────────────────────────────────────────

  const unreadCountByLeague = computed(() => {
    const map: Record<string, number> = {};
    allNotifications.value.forEach((n) => {
      if (!n.isRead) {
        map[n.leagueId] = (map[n.leagueId] ?? 0) + 1;
      }
    });
    return map;
  });

  // ── markAsRead mutation ──────────────────────────────────────────────────

  const { mutate: markAsRead } = useMutation({
    mutationFn: (id: string) => api.notifications.markAsRead(id),
    // Optimistically update the cache so the badge drops immediately
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      queryClient.setQueryData<NotificationDTO[]>(
        ["notifications"],
        (old) => old?.map((n) => (n.id === id ? { ...n, read: true } : n)) ?? []
      );
    },
    onError: () => {
      // Roll back on failure
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    allNotifications,
    currentLeagueNotifications,
    isLoading,
    refetch,
    unreadCount,
    notificationStore: currentLeagueUnread,
    currentLeagueUnreadCount,
    unreadCountByLeague,
    markAsRead,
  };
}
