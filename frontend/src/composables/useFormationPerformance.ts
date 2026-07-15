import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import {
  fetchMyPerformances,
  type TeamPerformance,
} from "@/services/performanceService";
import type { DraftFormationDTO } from "../../../dto/formationDTO";

/**
 * Server state for the "last night's performance" view.
 *
 * Reads the current player's two most recent scored days for the active league
 * (see `performanceService.fetchMyPerformances`) and exposes:
 *   - `latest`   — the most recent scored day (last night)
 *   - `previous` — the night before, when present, for a day-over-day delta
 *   - `pointsDelta` / `pointsDeltaPercent` — change vs. the previous night
 *   - `formation` — the scored snapshot as a DraftFormationDTO the read-only
 *     `TeamFormation` pitch renders directly
 *
 * League-scoped: the query key carries the league id, so switching leagues
 * (via `useLeagueStore`) refetches automatically, matching `useDashboard`.
 */
export function useFormationPerformance() {
  const leagueStore = useLeagueStore();

  const { data, isLoading, isError, error, refetch } = useQuery<
    TeamPerformance[]
  >({
    queryKey: computed(() => [
      "formation-performance",
      leagueStore.currentLeagueId,
    ]),
    queryFn: () => fetchMyPerformances(leagueStore.currentLeagueId!, 2),
    enabled: computed(() => !!leagueStore.currentLeagueId),
  });

  const latest = computed<TeamPerformance | null>(
    () => data.value?.[0] ?? null
  );
  const previous = computed<TeamPerformance | null>(
    () => data.value?.[1] ?? null
  );

  /** True once the query resolved but the team has no scored day yet. */
  const hasPerformance = computed(() => latest.value !== null);

  const points = computed(() => latest.value?.points ?? 0);

  /** Absolute point change vs. the night before (null when there's no prior day). */
  const pointsDelta = computed<number | null>(() =>
    previous.value ? points.value - previous.value.points : null
  );

  /** Rounded percentage change vs. the night before (null when not computable). */
  const pointsDeltaPercent = computed<number | null>(() => {
    const prior = previous.value?.points ?? 0;
    if (prior <= 0) return null;
    return Math.round(((points.value - prior) / prior) * 100);
  });

  /**
   * The scored snapshot as a DraftFormationDTO — `FormationDTO` is a structural
   * superset (every slot filled), so `TeamFormation` renders it read-only with
   * no swap handlers wired.
   */
  const formation = computed<DraftFormationDTO | null>(
    () => (latest.value?.formation as DraftFormationDTO) ?? null
  );

  return {
    // Query state
    isLoading,
    isError,
    error,
    refetch,
    // Data
    latest,
    previous,
    hasPerformance,
    points,
    pointsDelta,
    pointsDeltaPercent,
    formation,
  };
}
