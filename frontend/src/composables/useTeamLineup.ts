import { ref, computed, watch } from "vue";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import { fetchTeam, saveTeamApi } from "@/services/teamService";
import { createWikimediaClient } from "@/services/wikimediaClient";
import {
  createDraftFormation,
  createChemistryLinks,
  isCompleteFormation,
  computeChemistryLinks,
  type DraftFormationDTO,
  type FormationDTO,
  type Schema,
  type Position,
} from "../../../dto/formationDTO";
import {
  type DraftLineup,
  assignToPosition as assignToPositionMutation,
  removeFromPosition as removeFromPositionMutation,
  swapSlots as swapSlotsMutation,
  moveToEmpty as moveToEmptyMutation,
  setSchema as setSchemaMutation,
} from "../../../dto/lineupMutations";
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

  const wikimediaClient = createWikimediaClient();

  // Extract the titles of all players currently placed in the formation.
  const activeArticles = computed(() => {
    const titles = new Set<string>();
    for (const pos of Object.keys(draft.value.formation)) {
      const contract = draft.value.formation[pos as Position];
      if (contract) titles.add(contract.article.title);
    }
    return Array.from(titles);
  });

  const chemistryQueryKey = computed(() => [
    "chemistry",
    leagueStore.currentLeagueId,
    draft.value.schema,
    ...Object.entries(draft.value.formation as Record<string, ContractDTO>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([pos, contract]) => `${pos}:${contract.article.title}`),
  ]);

  const { data: chemistryData } = useQuery({
    queryKey: chemistryQueryKey,
    queryFn: async () => {
      // Snapshot schema and formation before the async wait so we can detect
      // a stale result if the user changes the formation mid-fetch.
      const capturedSchema = draft.value.schema;
      const capturedFormation = draft.value.formation;
      const domain = leagueStore.currentLeague?.domain ?? "en";
      const titles = activeArticles.value;

      const results = await Promise.all(
        titles.map((title) =>
          wikimediaClient.article.getLinkedArticles(domain, title)
        )
      );

      // If the formation changed while we were awaiting Wikimedia, discard this
      // result so a stale fetch cannot overwrite chemistry for the new formation.
      if (
        draft.value.schema !== capturedSchema ||
        draft.value.formation !== capturedFormation
      ) {
        return null;
      }

      const linksMap = new Map<string, string[]>();
      for (const res of results) {
        linksMap.set(res.title, res.linkedArticles);
      }

      return computeChemistryLinks(capturedSchema, capturedFormation, linksMap);
    },
    enabled: computed(() => !!leagueStore.currentLeagueId),
    // Keep chemistry fresh for 30 s so re-entering a cached Ionic view does not
    // trigger an immediate background refetch (which would cause a grey flash).
    staleTime: 30_000,
  });

  // Apply chemistry to the draft as soon as TanStack Query has data — either
  // from a fresh fetch or a cache hit. Because the dashboard and the team page
  // share the same query client, the dashboard's fetch pre-populates the cache,
  // so navigation to the team page resolves instantly from cache with no grey flash.
  watch(
    chemistryData,
    (chemistry) => {
      if (!chemistry || !Array.isArray(chemistry)) return;
      draft.value = { ...draft.value, chemistry };
    },
    { immediate: true }
  );

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
      const chemistry =
        lineup.formation.chemistry ??
        createChemistryLinks(lineup.formation.schema);
      draft.value = {
        date: lineup.formation.date,
        schema: lineup.formation.schema,
        formation: { ...lineup.formation.formation },
        chemistry,
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
  // Thin reactive shell over the pure mutations in dto/lineupMutations.ts:
  // snapshot the live state, run the pure transform, write the result back.
  function currentLineup(): DraftLineup {
    return { formation: draft.value, bench: benchContracts.value };
  }

  function applyMutation(next: DraftLineup) {
    draft.value = next.formation;
    benchContracts.value = next.bench;
  }

  function setSchema(nextSchema: Schema) {
    applyMutation(setSchemaMutation(currentLineup(), nextSchema));
  }

  function assignToPosition(position: Position, contract: ContractDTO) {
    applyMutation(
      assignToPositionMutation(currentLineup(), position, contract)
    );
  }

  function removeFromPosition(position: Position) {
    applyMutation(removeFromPositionMutation(currentLineup(), position));
  }

  function swapSlots(fromId: string, toPos: string, toId: string | null) {
    applyMutation(swapSlotsMutation(currentLineup(), fromId, toPos, toId));
  }

  function moveToEmpty(fromId: string, targetPos: Position) {
    applyMutation(moveToEmptyMutation(currentLineup(), fromId, targetPos));
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
