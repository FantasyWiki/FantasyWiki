/**
 * teamStore.ts
 *
 * Owns all team state and the dirty/auto-save lifecycle.
 * Components are purely presentational — they never mutate this store directly;
 * they call the exposed action functions instead.
 *
 * Auto-save design:
 *   - After any mutation isDirty becomes true.
 *   - A 12-second debounce timer triggers saveTeam() on idle.
 *   - onIonViewWillLeave in the page shell triggers saveTeam() on navigation.
 *   - No explicit "Save" button is required.
 */
import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { fetchTeam, saveTeamApi } from "@/services/teamService";
import { FORMATIONS } from "@/types/pitch";
import type { TeamResponse } from "@/types/team";
import type {
  FormationDTO,
  DraftFormationDTO,
  Schema,
  Position,
} from "@/../../dto/formationDTO";
import {
  createDraftFormation,
  changeSchema,
  isCompleteFormation,
  validateDraftFormation,
} from "@/../../dto/formationDTO";
import type { ContractDTO } from "@/../../dto/contractDTO";

export const useTeamStore = defineStore("team", () => {
  // ── Raw state ─────────────────────────────────────────────────────────────
  /**
   * The current draft formation the user is editing.
   * May be incomplete while the user is assigning contracts to positions.
   */
  const draft = ref<DraftFormationDTO>(createDraftFormation("4-3-3"));

  /** Contracts sitting on the bench (not in any formation slot). */
  const benchContracts = ref<ContractDTO[]>([]);

  // ── Context (set on loadTeam, reused for saves) ───────────────────────────
  const leagueId = ref<string>("");
  const userId = ref<string>("");

  // ── Loading / error ───────────────────────────────────────────────────────
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // ── Dirty tracking ────────────────────────────────────────────────────────
  const savedSnapshot = ref<string>("");
  const isSaving = ref(false);

  const isDirty = computed(() => {
    const current = JSON.stringify({
      draft: draft.value,
      bench: benchContracts.value.map((c) => c.id),
    });
    return current !== savedSnapshot.value;
  });

  // ── Computed ──────────────────────────────────────────────────────────────

  /** Current schema string, e.g. "4-3-3" */
  const schema = computed(() => draft.value.schema);

  /**
   * The active formation — only defined when the draft is complete.
   * Components that need a fully resolved formation should use this.
   */
  const formation = computed<FormationDTO | null>(() =>
    isCompleteFormation(draft.value) ? (draft.value as FormationDTO) : null
  );

  /**
   * The draft formation — always defined, may have missing positions.
   * Use for editing UI (pitch grid, slot assignment).
   */
  const draftFormation = computed(() => draft.value);

  /**
   * Positions required by the current schema.
   */
  const activePositions = computed(() => FORMATIONS[draft.value.schema] ?? []);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function loadTeam(lgId: string, uid: string) {
    leagueId.value = lgId;
    userId.value = uid;
    isLoading.value = true;
    error.value = null;

    try {
      const team: TeamResponse = await fetchTeam(lgId, uid);

      // The API already returns a fully resolved FormationDTO.
      // We treat it as a draft so the user can edit it freely.
      draft.value = {
        date: team.formation.date,
        schema: team.formation.schema,
        formation: { ...team.formation.formation },
      };

      benchContracts.value = team.bench;

      // Snapshot the just-loaded state so isDirty starts as false.
      savedSnapshot.value = JSON.stringify({
        draft: draft.value,
        bench: benchContracts.value.map((c) => c.id),
      });
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : "Unknown error";
    } finally {
      isLoading.value = false;
    }
  }

  async function saveTeam() {
    if (!isDirty.value || isSaving.value) return;
    if (!isCompleteFormation(draft.value)) {
      console.warn("Cannot save: formation is incomplete.");
      return;
    }

    isSaving.value = true;
    try {
      await saveTeamApi(leagueId.value, userId.value, {
        formation: draft.value as FormationDTO,
        bench: benchContracts.value,
      });

      savedSnapshot.value = JSON.stringify({
        draft: draft.value,
        bench: benchContracts.value.map((c) => c.id),
      });
    } finally {
      isSaving.value = false;
    }
  }

  /**
   * Change the active formation schema.
   * Contracts are remapped to the new schema positions automatically.
   */
  function setSchema(nextSchema: Schema) {
    draft.value = changeSchema(draft.value, nextSchema);
  }

  /**
   * Assign a contract to a specific pitch position.
   * If another contract was already in that slot, it goes to the bench.
   */
  function assignToPosition(position: Position, contract: ContractDTO) {
    const displaced = draft.value.formation[position] ?? null;

    draft.value = {
      ...draft.value,
      formation: {
        ...draft.value.formation,
        [position]: contract,
      },
    };

    // Remove the newly placed contract from the bench (if it was there).
    benchContracts.value = benchContracts.value.filter(
      (c) => c.id !== contract.id
    );

    // Put the displaced contract back on the bench.
    if (displaced && displaced.id !== contract.id) {
      benchContracts.value = [...benchContracts.value, displaced];
    }
  }

  /**
   * Remove a contract from a pitch position and send it to the bench.
   */
  function removeFromPosition(position: Position) {
    const contract = draft.value.formation[position];
    if (!contract) return;

    const newFormation = { ...draft.value.formation };
    delete newFormation[position];

    draft.value = { ...draft.value, formation: newFormation };
    benchContracts.value = [...benchContracts.value, contract];
  }

  /**
   * Swap two articles — works for pitch↔pitch, pitch↔bench, bench↔bench.
   *
   * @param fromId  contractId of the article being moved
   * @param toPos   target positionKey on the pitch OR "bench"
   * @param toId    contractId currently at toPos (null if slot is empty)
   */
  function swapSlots(fromId: string, toPos: string, toId: string | null) {
    // Locate where fromId currently lives
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
      // Moving to bench
      if (fromPos) {
        const newFormation = { ...draft.value.formation };
        if (toId) {
          // Swap with a bench contract: put toId into fromPos
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
        // Reorder bench — swap positions
        const bench = [...benchContracts.value];
        const a = bench.findIndex((c) => c.id === fromId);
        const b = bench.findIndex((c) => c.id === toId);
        if (a !== -1 && b !== -1) [bench[a], bench[b]] = [bench[b], bench[a]];
        benchContracts.value = bench;
      }
    } else {
      // Moving to a pitch position
      const targetPos = toPos as Position;
      const toContract =
        draft.value.formation[targetPos] ??
        benchContracts.value.find((c) => c.id === toId) ??
        null;

      const newFormation = { ...draft.value.formation };
      newFormation[targetPos] = fromContract;

      if (fromPos) {
        // Pitch → pitch swap
        if (toContract) newFormation[fromPos] = toContract;
        else delete newFormation[fromPos];
      } else if (fromOnBench) {
        // Bench → pitch
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

  /**
   * Move a contract from its current position to an empty pitch slot.
   */
  function moveToEmpty(fromId: string, targetPos: Position) {
    const fromPos = (
      Object.entries(draft.value.formation) as [Position, ContractDTO][]
    ).find(([, c]) => c.id === fromId)?.[0];

    const fromOnBench = benchContracts.value.some((c) => c.id === fromId);
    const fromContract =
      (fromPos ? draft.value.formation[fromPos] : null) ??
      benchContracts.value.find((c) => c.id === fromId) ??
      null;

    if (!fromContract) return;
    if (draft.value.formation[targetPos]) return; // Slot is not empty

    const newFormation = { ...draft.value.formation };
    newFormation[targetPos] = fromContract;

    if (fromPos) {
      delete newFormation[fromPos];
    } else if (fromOnBench) {
      benchContracts.value = benchContracts.value.filter(
        (c) => c.id !== fromId
      );
    }

    draft.value = { ...draft.value, formation: newFormation };
  }

  // ── Auto-save debounce (12 s idle) ────────────────────────────────────────
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleAutoSave() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (isDirty.value) saveTeam();
    }, 12_000);
  }

  watch(
    [draft, benchContracts],
    () => {
      if (isDirty.value) scheduleAutoSave();
    },
    { deep: true }
  );

  // ── Expose ────────────────────────────────────────────────────────────────
  return {
    // State
    draft,
    benchContracts,
    // Computed
    schema,
    formation,
    draftFormation,
    activePositions,
    // Status
    isLoading,
    error,
    isDirty,
    isSaving,
    // Actions
    loadTeam,
    saveTeam,
    setSchema,
    assignToPosition,
    removeFromPosition,
    swapSlots,
    moveToEmpty,
  };
});
