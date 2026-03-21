// frontend/src/composables/useTrades.ts
import { computed } from "vue";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import api from "@/services/api";
import type { TradeProposal } from "@/types/models";

/**
 * Provides trade proposals for the currently active league.
 *
 * - useQuery fetches and caches proposals scoped to the current leagueId.
 * - useMutation handles accept/reject with optimistic updates and automatic
 *   rollback if the API call fails.
 * - Switching leagues invalidates the cache via the queryKey, triggering
 *   a fresh fetch automatically — no manual clear() needed.
 */
export function useTrades() {
  const leagueStore = useLeagueStore();
  const queryClient = useQueryClient();

  // ── Query key factory ──────────────────────────────────────────────────────
  // Defined as a computed so mutations can reference the current key.

  const queryKey = computed(() => ["trades", leagueStore.currentLeagueId]);

  // ── Query ──────────────────────────────────────────────────────────────────

  const {
    data: proposals,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<TradeProposal[]>({
    queryKey,
    queryFn: () => api.leagues.getTrades(leagueStore.currentLeagueId!),
    enabled: computed(() => !!leagueStore.currentLeagueId),
    // Default to empty array so consumers don't need to null-check.
    placeholderData: [],
    // placeholderData (not initialData) — same reason as above.
  });

  // ── Derived ────────────────────────────────────────────────────────────────

  /** Only incoming + pending proposals — what the inbox bell shows. */
  const incomingPending = computed(() =>
    (proposals.value ?? []).filter(
      (p) => p.type === "incoming" && p.status === "pending"
    )
  );

  /** Badge count for the inbox bell. */
  const pendingCount = computed(() => incomingPending.value.length);

  // ── Mutations ──────────────────────────────────────────────────────────────

  /**
   * Shared optimistic update logic.
   * Immediately flips the proposal's status in the cache so the UI reacts
   * instantly. Returns the previous cache snapshot for rollback on error.
   */
  function makeOptimisticMutation(newStatus: "accepted" | "rejected") {
    return {
      onMutate: async (tradeId: string) => {
        // Cancel any in-flight refetch so it doesn't overwrite our optimistic update.
        await queryClient.cancelQueries({ queryKey: queryKey.value });

        // Snapshot the previous value for rollback.
        const previous = queryClient.getQueryData<TradeProposal[]>(
          queryKey.value
        );

        // Optimistically update the cache.
        queryClient.setQueryData<TradeProposal[]>(queryKey.value, (old) =>
          (old ?? []).map((p) =>
            p.id === tradeId ? { ...p, status: newStatus } : p
          )
        );

        return { previous };
      },

      // If the API call fails, restore the snapshot.
      onError: (
        _err: unknown,
        _tradeId: string,
        context: { previous?: TradeProposal[] } | undefined
      ) => {
        if (context?.previous) {
          queryClient.setQueryData(queryKey.value, context.previous);
        }
      },

      // Whether the call succeeded or failed, sync with the server.
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKey.value });
      },
    };
  }

  const { mutateAsync: accept, isPending: isAccepting } = useMutation({
    mutationFn: (tradeId: string) => api.trades.accept(tradeId),
    ...makeOptimisticMutation("accepted"),
  });

  const { mutateAsync: reject, isPending: isRejecting } = useMutation({
    mutationFn: (tradeId: string) => api.trades.reject(tradeId),
    ...makeOptimisticMutation("rejected"),
  });

  return {
    // Query state
    proposals,
    isLoading,
    isError,
    error,
    refetch,
    // Derived
    incomingPending,
    pendingCount,
    // Mutations
    accept,
    reject,
    isActioning: computed(() => isAccepting.value || isRejecting.value),
  };
}
