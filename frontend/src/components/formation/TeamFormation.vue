<template>
  <ion-card class="pitch-card">
    <div class="pitch">
      <!-- ── Decorative pitch markings ──────────────────────────────────── -->
      <div class="pitch-center-line" aria-hidden="true" />
      <div class="pitch-center-circle" aria-hidden="true" />
      <!-- Goal area top -->
      <div class="pitch-goal pitch-goal--top" aria-hidden="true" />
      <!-- Goal area bottom -->
      <div class="pitch-goal pitch-goal--bottom" aria-hidden="true" />

      <!-- ── Swap-mode banner ───────────────────────────────────────────── -->
      <transition name="fade">
        <div v-if="swapMode && swapSource" class="swap-banner">
          <ion-icon :icon="swapHorizontalOutline" />
          <span>
            Select a position to swap with
            <strong>{{ swapSource.article.title }}</strong>
          </span>
          <button class="swap-cancel" @click="$emit('cancelSwap')">✕</button>
        </div>
      </transition>

      <!-- ── Main grid ──────────────────────────────────────────────────── -->
      <div class="pitch-grid" role="grid" aria-label="Formation grid">
        <template v-for="posKey in activePositions" :key="posKey">
          <!-- Filled slot -->
          <ArticleNode
            v-if="formation.formation[posKey]"
            :article="formation.formation[posKey]!"
            :is-goalkeeper="posKey === 'GK'"
            :swap-mode="
              swapMode && formation.formation[posKey]?.id !== swapSource?.id
            "
            :selected="formation.formation[posKey]?.id === swapSource?.id"
            :style="gridStyle(posKey)"
            @click="$emit('articleClick', formation.formation[posKey]!)"
            @swap="(fromId, toId) => $emit('swap', fromId, toId)"
          />

          <!-- Empty / unfilled slot -->
          <div
            v-else
            class="pitch-slot-empty"
            :style="gridStyle(posKey)"
            :class="{ 'pitch-slot-empty--swap': swapMode }"
            :aria-label="`Empty position ${posKey}`"
            @click="
              swapMode && swapSource ? $emit('moveToEmpty', posKey) : undefined
            "
          >
            <span class="slot-pos-label">{{ posKey }}</span>
            <ion-icon
              v-if="swapMode && swapSource"
              :icon="addCircleOutline"
              class="slot-add-icon"
            />
          </div>
        </template>
      </div>

      <!-- ── Chemistry legend ───────────────────────────────────────────── -->
      <div class="chemistry-legend" role="list" aria-label="Chemistry bonuses">
        <span class="chem-item chem-high" role="listitem">+20%</span>
        <span class="chem-item chem-mid" role="listitem">+10%</span>
        <span class="chem-item chem-low" role="listitem">+5%</span>
        <span class="chem-item chem-none" role="listitem">0%</span>
      </div>
    </div>
  </ion-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IonCard, IonIcon } from "@ionic/vue";
import { swapHorizontalOutline, addCircleOutline } from "ionicons/icons";
import { POSITION_MAP, FORMATIONS } from "@/types/pitch";
import type { DraftFormationDTO, Position } from "../../../../dto/formationDTO";
import type { ContractDTO } from "../../../../dto/contractDTO";
import ArticleNode from "./ArticleNode.vue";

const props = defineProps<{
  /** The current draft formation (may have missing slots) */
  formation: DraftFormationDTO;
  /** When true, ArticleNodes pulse to indicate they are swap targets */
  swapMode?: boolean;
  /** The article currently selected as the swap source (highlighted differently) */
  swapSource?: ContractDTO | null;
}>();

const emit = defineEmits<{
  /** User clicked a filled slot */
  articleClick: [article: ContractDTO];
  /** User dropped/clicked a swap target (string IDs) */
  swap: [fromId: string, toId: string];
  /** User clicked an empty slot while in swap mode */
  moveToEmpty: [posKey: string];
  /** User dismissed the swap banner */
  cancelSwap: [];
}>();

/** Positions required by the current schema */
const activePositions = computed(
  () => FORMATIONS[props.formation.schema] ?? []
);

/**
 * Returns inline CSS grid-placement styles for the given position key.
 * CSS grid is 1-indexed; POSITION_MAP uses 0-indexed values.
 */
function gridStyle(posKey: Position): Record<string, string> {
  const pos = POSITION_MAP[posKey];
  if (!pos) return {};
  return {
    gridRow: String(pos.row + 1),
    gridColumn: String(pos.col + 1),
  };
}
</script>

<style scoped>
/* ── Card shell ───────────────────────────────────────────────────────────── */
.pitch-card {
  margin: 0 0 16px;
  --background: transparent;
  box-shadow: none;
  border: none;
}

/* ── Pitch background ─────────────────────────────────────────────────────── */
.pitch {
  position: relative;
  background: linear-gradient(
    to bottom,
    rgba(var(--ion-color-primary-rgb), 0.04) 0%,
    rgba(var(--ion-color-primary-rgb), 0.1) 50%,
    rgba(var(--ion-color-primary-rgb), 0.04) 100%
  );
  border-radius: 12px;
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.18);
  overflow: visible;
  padding: 16px 8px 24px;
}

/* ── Pitch markings ───────────────────────────────────────────────────────── */
.pitch-center-line {
  position: absolute;
  left: 8px;
  right: 8px;
  top: 50%;
  height: 1px;
  background: rgba(var(--ion-color-primary-rgb), 0.18);
  pointer-events: none;
}

.pitch-center-circle {
  position: absolute;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.18);
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.pitch-goal {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 40%;
  height: 28px;
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.18);
  pointer-events: none;
}
.pitch-goal--top {
  top: 0;
  border-top: none;
  border-radius: 0 0 6px 6px;
}
.pitch-goal--bottom {
  bottom: 0;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
}

/* ── Swap mode banner ─────────────────────────────────────────────────────── */
.swap-banner {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--ion-color-dark);
  color: var(--ion-color-dark-contrast);
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.swap-cancel {
  background: none;
  border: none;
  color: var(--ion-color-dark-contrast);
  cursor: pointer;
  font-size: 14px;
  padding: 0 0 0 4px;
  line-height: 1;
  opacity: 0.7;
}
.swap-cancel:hover {
  opacity: 1;
}

/* ── Main grid ────────────────────────────────────────────────────────────── */
.pitch-grid {
  display: grid;
  grid-template-rows: repeat(6, minmax(60px, auto));
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  min-height: 480px;
  position: relative;
  z-index: 1;
}

/* ── Empty slot placeholder ───────────────────────────────────────────────── */
.pitch-slot-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 2px dashed rgba(var(--ion-color-medium-rgb), 0.3);
  border-radius: 8px;
  min-height: 56px;
  transition:
    border-color 180ms ease,
    background 180ms ease;
}

.slot-pos-label {
  font-size: 10px;
  color: var(--ion-color-medium);
  font-weight: 600;
}

.slot-add-icon {
  font-size: 16px;
  color: var(--ion-color-primary);
  opacity: 0.6;
}

/* Empty slot becomes a valid drop target in swap mode */
.pitch-slot-empty--swap {
  border-color: rgba(var(--ion-color-primary-rgb), 0.5);
  cursor: pointer;
}
.pitch-slot-empty--swap:hover {
  background: rgba(var(--ion-color-primary-rgb), 0.06);
}
.pitch-slot-empty--swap .slot-add-icon {
  opacity: 1;
}

/* ── Chemistry legend ─────────────────────────────────────────────────────── */
.chemistry-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(var(--ion-color-primary-rgb), 0.18);
  margin-top: 12px;
  justify-content: center;
}

.chem-item {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 999px;
}

.chem-high {
  background: rgba(var(--ion-color-primary-rgb), 0.15);
  color: var(--ion-color-primary);
}
.chem-mid {
  background: rgba(var(--ion-color-warning-rgb), 0.2);
  color: var(--ion-color-warning);
}
.chem-low {
  background: rgba(var(--ion-color-tertiary-rgb), 0.2);
  color: var(--ion-color-tertiary);
}
.chem-none {
  background: var(--ion-color-light);
  color: var(--ion-color-medium);
}

/* ── Transitions ──────────────────────────────────────────────────────────── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
