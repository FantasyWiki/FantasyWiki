import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { queryKeys } from "@/composables/queryKeys";
import { useLeaderboard } from "@/composables/useLeaderboard";
import { useMyTeam } from "@/composables/useMyTeam";
import { fetchRivalLineup } from "@/services/teamService";
import type { TeamLineUp } from "@/types/team";
import type { LeaderboardEntryDTO } from "../../../dto/leaderboardDTO";

/**
 * Everything the rival team page renders: one other team's line-up, plus the
 * standings row that gives it a name, a rank and a points total.
 *
 * Identity comes from the leaderboard rather than a team endpoint because the
 * standings already carry every field the header shows, and the page is only
 * ever reached from that same board — so the query is usually a cache hit and
 * the header paints with the pitch instead of after it.
 */
export function useRivalLineup(
  leagueId: MaybeRefOrGetter<string | undefined>,
  teamId: MaybeRefOrGetter<string | undefined>
) {
  const league = computed(() => toValue(leagueId) ?? null);
  const team = computed(() => toValue(teamId) ?? null);

  const {
    leaderboard,
    isLoading: isLeaderboardLoading,
    isError: isLeaderboardError,
    refetch: refetchLeaderboard,
  } = useLeaderboard(league);

  const { myTeam } = useMyTeam(league);

  const {
    data: lineup,
    isLoading: isLineupLoading,
    isError: isLineupError,
    error,
    refetch: refetchLineup,
  } = useQuery<TeamLineUp>({
    queryKey: computed(() => queryKeys.rivalLineup(league.value, team.value)),
    queryFn: () => fetchRivalLineup(league.value!, team.value!),
    enabled: computed(() => !!league.value && !!team.value),
  });

  const entry = computed<LeaderboardEntryDTO | null>(
    () => leaderboard.value.find((e) => e.team.id === team.value) ?? null
  );

  /**
   * The viewer's own standings row, for the head-to-head strip. Null when they
   * only spectate this league — the strip is then simply not shown, which is
   * honest, where a zero would read as "you are on nothing".
   */
  const mine = computed<LeaderboardEntryDTO | null>(() => {
    const id = myTeam.value?.id;
    if (!id) return null;
    return leaderboard.value.find((e) => e.team.id === id) ?? null;
  });

  /**
   * Points the rival is ahead by; negative when the viewer leads. Null unless
   * both rows are known, so the strip never compares against a missing half.
   */
  const pointsGap = computed<number | null>(() => {
    if (!entry.value || !mine.value) return null;
    return entry.value.cumulativePoints - mine.value.cumulativePoints;
  });

  /**
   * The team is in this league but its row has not arrived yet vs. it is not in
   * this league at all. Only the settled second case is a 404 for the page.
   */
  const isUnknownTeam = computed(
    () => !isLeaderboardLoading.value && !!team.value && entry.value === null
  );

  const isOwnTeam = computed(
    () => !!myTeam.value?.id && myTeam.value.id === team.value
  );

  return {
    entry,
    mine,
    pointsGap,
    lineup,
    isOwnTeam,
    isUnknownTeam,
    isLeaderboardLoading,
    isLineupLoading,
    isError: computed(() => isLineupError.value || isLeaderboardError.value),
    error,
    async refetch() {
      await Promise.all([refetchLeaderboard(), refetchLineup()]);
    },
  };
}
