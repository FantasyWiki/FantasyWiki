import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import { fetchTeam } from "@/services/teamService";
import {
  createDraftFormation,
  type DraftFormationDTO,
} from "@/../../dto/formationDTO";
import type { TeamLineUp } from "@/types/team";

export function useTeamLineup() {
  const leagueStore = useLeagueStore();

  const {
    data: teamLineup,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<TeamLineUp>({
    queryKey: computed(() => ["team-lineup", leagueStore.currentLeagueId]),
    queryFn: () => fetchTeam(leagueStore.currentLeagueId!),
    enabled: computed(() => !!leagueStore.currentLeagueId),
  });

  const draftFormation = computed<DraftFormationDTO>(() => {
    const lineup = teamLineup.value;
    if (!lineup) return createDraftFormation("4-3-3");

    return {
      date: lineup.formation.date,
      schema: lineup.formation.schema,
      formation: { ...lineup.formation.formation },
    };
  });

  return {
    teamLineup,
    draftFormation,
    isLoading,
    isError,
    error,
    refetch,
  };
}

