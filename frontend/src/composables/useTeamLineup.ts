import { ref, computed, watch } from "vue";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import { fetchTeam, saveTeamApi } from "@/services/teamService";
import {
  createDraftFormation,
  changeSchema,
  isCompleteFormation,
  type DraftFormationDTO,
  type FormationDTO,
  type Schema,
  type Position,
} from "../../../dto/formationDTO";
import type { TeamLineUp } from "@/types/team";
import type { ContractDTO } from "../../../dto/contractDTO";

export function useTeamLineup() {
  const leagueStore = useLeagueStore();
  const queryClient = useQueryClient();

  const queryKey = computed(() => ["team-lineup", leagueStore.currentLeagueId]);

  const {
    data: teamLineup,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<TeamLineUp>({
    queryKey,
    queryFn: () => fetchTeam(leagueStore.currentLeagueId!),
    enabled: computed(() => !!leagueStore.currentLeagueId),
  });

  // ── Local draft state ─────────────────────────────────────────────────────
  const draft = ref<DraftFormationDTO>(createDraftFormation("4-3-3"));
  const benchContracts = ref<ContractDTO[]>([]);
  const savedSnapshot = ref<string>("");
  // Tracks whether server data has been loaded into the draft at least once.
  const isInitialized = ref(false);

  // ── Dirty tracking ────────────────────────────────────────────────────────
  const isDirty = computed(() => {
    const current = JSON.stringify({
      draft: draft.value,
      bench: benchContracts.value.map((c) => c.id),
    });
    return current !== savedSnapshot.value;
  });

  // Sync draft from server data on first load and after a successful save
  // (isDirty will be false then). Skips sync when the user has unsaved edits
  // to avoid clobbering changes on automatic refetches (e.g. window focus).
  watch(
    teamLineup,
    (lineup) => {
      if (!lineup) return;
      if (isInitialized.value && isDirty.value) return;
      draft.value = {
        date: lineup.formation.date,
        schema: lineup.formation.schema,
        formation: { ...lineup.formation.formation },
      };
      benchContracts.value = [...lineup.bench];
      savedSnapshot.value = JSON.stringify({
        draft: draft.value,
        bench: benchContracts.value.map((c) => c.id),
      });
      isInitialized.value = true;
    },
    { immediate: true }
  );

  watch(
    () => leagueStore.currentLeagueId,
    (nextLeagueId, previousLeagueId) => {
      if (nextLeagueId === previousLeagueId) return;
      draft.value = createDraftFormation("4-3-3");
      benchContracts.value = [];
      savedSnapshot.value = "";
      isInitialized.value = false;
    }
  );

  // ── Save mutation ─────────────────────────────────────────────────────────
  const { mutateAsync: saveTeam, isPending: isSaving } = useMutation({
    mutationFn: () => {
      if (!isCompleteFormation(draft.value)) {
        throw new Error("Formation is incomplete.");
      }
      return saveTeamApi(leagueStore.currentLeagueId!, {
        formation: draft.value as FormationDTO,
        bench: benchContracts.value,
      });
    },
    onSuccess: () => {
      savedSnapshot.value = JSON.stringify({
        draft: draft.value,
        bench: benchContracts.value.map((c) => c.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // ── Computed ──────────────────────────────────────────────────────────────
  const schema = computed(() => draft.value.schema);
  const draftFormation = computed(() => draft.value);
  const formation = computed<FormationDTO | null>(() =>
    isCompleteFormation(draft.value) ? (draft.value as FormationDTO) : null
  );

  // ── Mutation helpers ──────────────────────────────────────────────────────
  function setSchema(nextSchema: Schema) {
    draft.value = changeSchema(draft.value, nextSchema);
  }

  function assignToPosition(position: Position, contract: ContractDTO) {
    const displaced = draft.value.formation[position] ?? null;
    draft.value = {
      ...draft.value,
      formation: { ...draft.value.formation, [position]: contract },
    };
    benchContracts.value = benchContracts.value.filter(
      (c) => c.id !== contract.id
    );
    if (displaced && displaced.id !== contract.id) {
      benchContracts.value = [...benchContracts.value, displaced];
    }
  }

  function removeFromPosition(position: Position) {
    const contract = draft.value.formation[position];
    if (!contract) return;
    const newFormation = { ...draft.value.formation };
    delete newFormation[position];
    draft.value = { ...draft.value, formation: newFormation };
    benchContracts.value = [...benchContracts.value, contract];
  }

  function swapSlots(fromId: string, toPos: string, toId: string | null) {
    const fromPos = (
      Object.entries(draft.value.formation) as [Position, ContractDTO][]
    ).find(([, c]) => c.id === fromId)?.[0];

    const fromOnBench = benchContracts.value.some((c) => c.id === fromId);
    const fromContract =
      (fromPos ? draft.value.formation[fromPos] : null) ??
      benchContracts.value.find((c) => c.id === fromId) ??
      null;

    if (!fromContract) return;

    if (toPos === "bench") {
      if (fromPos) {
        const newFormation = { ...draft.value.formation };
        if (toId) {
          const toContract = benchContracts.value.find((c) => c.id === toId);
          if (toContract) newFormation[fromPos] = toContract;
          else delete newFormation[fromPos];
        } else {
          delete newFormation[fromPos];
        }
        draft.value = { ...draft.value, formation: newFormation };
      }
      if (!fromOnBench) {
        benchContracts.value = [
          ...benchContracts.value.filter((c) => c.id !== toId),
          fromContract,
        ];
      } else if (fromOnBench && toId) {
        const bench = [...benchContracts.value];
        const a = bench.findIndex((c) => c.id === fromId);
        const b = bench.findIndex((c) => c.id === toId);
        if (a !== -1 && b !== -1) [bench[a], bench[b]] = [bench[b], bench[a]];
        benchContracts.value = bench;
      }
    } else {
      const targetPos = toPos as Position;
      const toContract =
        draft.value.formation[targetPos] ??
        benchContracts.value.find((c) => c.id === toId) ??
        null;
      const newFormation = { ...draft.value.formation };
      newFormation[targetPos] = fromContract;
      if (fromPos) {
        if (toContract) newFormation[fromPos] = toContract;
        else delete newFormation[fromPos];
      } else if (fromOnBench) {
        benchContracts.value = benchContracts.value.filter(
          (c) => c.id !== fromId
        );
        if (toContract) {
          benchContracts.value = [...benchContracts.value, toContract];
        }
      }
      draft.value = { ...draft.value, formation: newFormation };
    }
  }

  function moveToEmpty(fromId: string, targetPos: Position) {
    const fromPos = (
      Object.entries(draft.value.formation) as [Position, ContractDTO][]
    ).find(([, c]) => c.id === fromId)?.[0];

    const fromOnBench = benchContracts.value.some((c) => c.id === fromId);
    const fromContract =
      (fromPos ? draft.value.formation[fromPos] : null) ??
      benchContracts.value.find((c) => c.id === fromId) ??
      null;

    if (!fromContract || draft.value.formation[targetPos]) return;

    const newFormation = { ...draft.value.formation };
    newFormation[targetPos] = fromContract;
    if (fromPos) delete newFormation[fromPos];
    else if (fromOnBench) {
      benchContracts.value = benchContracts.value.filter(
        (c) => c.id !== fromId
      );
    }
    draft.value = { ...draft.value, formation: newFormation };
  }

  return {
    teamLineup,
    isLoading,
    isError,
    error,
    refetch,
    draft,
    benchContracts,
    schema,
    draftFormation,
    formation,
    isDirty,
    isSaving,
    saveTeam,
    setSchema,
    assignToPosition,
    removeFromPosition,
    swapSlots,
    moveToEmpty,
  };
}
