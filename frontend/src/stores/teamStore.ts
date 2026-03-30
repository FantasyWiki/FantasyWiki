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
import { fetchTeam, fetchContracts, saveTeamApi } from "@/services/teamService";
import { FORMATIONS } from "@/types/pitch";
import type { TeamResponse, Contract, SlotMap } from "@/types/team";

export const useTeamStore = defineStore("team", () => {
  // ── Raw API state ─────────────────────────────────────────────────────────
  const formation = ref<string>("4-3-3");
  const rawSlots = ref<Record<string, number | null>>({});
  const benchIds = ref<number[]>([]);
  const contractsById = ref<Map<number, Contract>>(new Map());

  // ── Context (set on loadTeam, reused for saves) ───────────────────────────
  const leagueId = ref<string>("");
  const userId = ref<string>("");

  // ── Loading / error ───────────────────────────────────────────────────────
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // ── Dirty tracking ────────────────────────────────────────────────────────
  // Compare current state to last-saved snapshot to avoid spurious saves.
  const savedSnapshot = ref<string>("");
  const isSaving = ref(false);

  const isDirty = computed(() => {
    const current = JSON.stringify({
      formation: formation.value,
      slots: rawSlots.value,
    });
    return current !== savedSnapshot.value;
  });

  // ── Computed ──────────────────────────────────────────────────────────────

  const activePositions = computed(
    () => FORMATIONS[formation.value] ?? []
  );

  /** SlotMap fed to <TeamFormation> — resolves contractIds to full objects. */
  const slotMap = computed<SlotMap>(() =>
    Object.fromEntries(
      activePositions.value.map((posKey) => {
        const id = rawSlots.value[posKey] ?? null;
        return [posKey, id ? (contractsById.value.get(id) ?? null) : null];
      })
    )
  );

  /** Bench articles fed to <BenchSection>. */
  const benchContracts = computed<Contract[]>(() =>
    benchIds.value
      .map((id) => contractsById.value.get(id))
      .filter(Boolean) as Contract[]
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  async function loadTeam(lgId: string, uid: string) {
    leagueId.value = lgId;
    userId.value = uid;
    isLoading.value = true;
    error.value = null;

    try {
      const team: TeamResponse = await fetchTeam(lgId, uid);
      formation.value = team.formation;
      rawSlots.value = team.slots;
      benchIds.value = team.bench;

      const allIds = [
        ...(Object.values(team.slots).filter(Boolean) as number[]),
        ...team.bench,
      ];
      const contracts = await fetchContracts(allIds);
      contractsById.value = new Map(contracts.map((c) => [c.id, c]));

      // Snapshot the just-loaded state so isDirty starts as false.
      savedSnapshot.value = JSON.stringify({
        formation: formation.value,
        slots: rawSlots.value,
      });
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : "Unknown error";
    } finally {
      isLoading.value = false;
    }
  }

  async function saveTeam() {
    if (!isDirty.value || isSaving.value) return;
    isSaving.value = true;
    try {
      await saveTeamApi(leagueId.value, userId.value, {
        formation: formation.value,
        slots: rawSlots.value,
        bench: benchIds.value,
      });
      savedSnapshot.value = JSON.stringify({
        formation: formation.value,
        slots: rawSlots.value,
      });
    } finally {
      isSaving.value = false;
    }
  }

  /**
   * Swap two articles — works for pitch↔pitch, pitch↔bench, bench↔bench.
   * @param fromId  contractId of the article being moved
   * @param toPos   target positionKey (pitch position key or 'bench')
   * @param toId    contractId of the article currently occupying toPos (if any)
   */
  function swapSlots(fromId: number, toPos: string, toId: number | null) {
    // Find where fromId currently lives
    const fromPos = Object.entries(rawSlots.value).find(
      ([, id]) => id === fromId
    )?.[0];
    const fromOnBench = benchIds.value.includes(fromId);

    if (toPos === "bench") {
      // Moving to bench
      if (fromPos) {
        rawSlots.value = { ...rawSlots.value, [fromPos]: toId };
      } else if (fromOnBench && toId !== null) {
        // Reorder bench
        const a = benchIds.value.indexOf(fromId);
        const b = benchIds.value.indexOf(toId);
        if (a !== -1 && b !== -1) {
          const next = [...benchIds.value];
          [next[a], next[b]] = [next[b], next[a]];
          benchIds.value = next;
        }
        return;
      }
      if (!fromOnBench) {
        benchIds.value = [...benchIds.value.filter((id) => id !== toId), fromId];
        if (toId !== null && fromPos) {
          rawSlots.value = { ...rawSlots.value, [fromPos]: toId };
        }
      }
    } else {
      // Moving to a pitch position
      if (fromPos) {
        rawSlots.value = {
          ...rawSlots.value,
          [fromPos]: toId,
          [toPos]: fromId,
        };
      } else if (fromOnBench) {
        rawSlots.value = { ...rawSlots.value, [toPos]: fromId };
        benchIds.value = benchIds.value.filter((id) => id !== fromId);
        if (toId !== null) benchIds.value = [...benchIds.value, toId];
      }
    }
  }

  // ── Auto-save debounce (12 s idle) ────────────────────────────────────────
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleAutoSave() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (isDirty.value) saveTeam();
    }, 12_000);
  }

  watch([formation, rawSlots], () => {
    if (isDirty.value) scheduleAutoSave();
  }, { deep: true });

  // ── Expose ────────────────────────────────────────────────────────────────
  return {
    // State
    formation,
    rawSlots,
    benchIds,
    // Computed
    activePositions,
    slotMap,
    benchContracts,
    // Status
    isLoading,
    error,
    isDirty,
    isSaving,
    // Actions
    loadTeam,
    saveTeam,
    swapSlots,
  };
});
