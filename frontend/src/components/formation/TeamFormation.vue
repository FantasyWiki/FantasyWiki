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
        <div v-if="swapMode && swapSource" class="swap-banner fm-center-row">
          <ion-icon :icon="swapHorizontalOutline" />
          <span>
            Select a position to swap with
            <strong>{{ swapSource.article.title }}</strong>
          </span>
          <ion-button
            class="swap-cancel"
            fill="clear"
            size="small"
            aria-label="Cancel swap"
            @click="$emit('cancelSwap')"
          >
            <ion-icon class="swap-cancel-icon" :icon="closeOutline" />
          </ion-button>
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
            class="pitch-slot-empty fm-center-col"
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
    </div>

    <!-- ── Chemistry legend ───────────────────────────────────────────── -->
    <div
      class="chemistry-legend"
      role="list"
      aria-label="Chemistry quality levels"
    >
      <ion-chip
        v-for="item in chemistryLegendItems"
        :key="item.level"
        class="chem-item"
        tabindex="-1"
        aria-disabled="true"
        role="listitem"
      >
        <span
          class="chem-marker"
          :class="{
            'chem-marker--excellent': item.level === 'excellent',
            'chem-marker--good': item.level === 'good',
            'chem-marker--weak': item.level === 'weak',
            'chem-marker--empty': item.level === 'empty',
          }"
          aria-hidden="true"
        />
        <ion-label>{{ item.label }}</ion-label>
      </ion-chip>
    </div>
  </ion-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { IonButton, IonCard, IonChip, IonIcon, IonLabel } from "@ionic/vue";
import {
  swapHorizontalOutline,
  addCircleOutline,
  closeOutline,
} from "ionicons/icons";
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

defineEmits<{
  /** User clicked a filled slot */
  articleClick: [article: ContractDTO];
  /** User dropped/clicked a swap target (string IDs) */
  swap: [fromId: string, toId: string];
  /** User clicked an empty slot while in swap mode */
  moveToEmpty: [posKey: string];
  /** User dismissed the swap banner */
  cancelSwap: [];
}>();

const chemistryLegendItems = [
  { level: "excellent", label: "Excellent +20%" },
  { level: "good", label: "Good +10%" },
  { level: "weak", label: "Weak +5%" },
  { level: "empty", label: "Empty 0%" },
] as const;

const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";
const isDesktop = ref(false);
let desktopMediaQuery: MediaQueryList | null = null;

function updateDesktopLayout(event?: MediaQueryListEvent): void {
  isDesktop.value = event ? event.matches : !!desktopMediaQuery?.matches;
}

onMounted(() => {
  desktopMediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
  updateDesktopLayout();
  desktopMediaQuery.addEventListener("change", updateDesktopLayout);
});

onBeforeUnmount(() => {
  desktopMediaQuery?.removeEventListener("change", updateDesktopLayout);
});

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

  if (isDesktop.value) {
    return {
      // Desktop: transpose coordinates to render a landscape pitch.
      gridRow: String(pos.col + 1),
      gridColumn: String(pos.row + 1),
    };
  }

  return {
    gridRow: String(pos.row + 1),
    gridColumn: String(pos.col + 1),
  };
}
</script>

<style scoped src="src/components/formation/formation-shared.css"></style>

<style scoped>
/* ── Card shell ───────────────────────────────────────────────────────────── */
.pitch-card {
  margin: 0 0 16px;
  --background: transparent;
  box-shadow: none;
  border: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Pitch background ─────────────────────────────────────────────────────── */
.pitch {
  position: relative;
  --slot-gap-mobile: 14px;
  --slot-gap-desktop: 18px;
  --node-size-mobile: 48px;
  --node-size-desktop: 56px;
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
  --color: var(--ion-color-dark-contrast);
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
  min-height: auto;
  height: 16px;
  margin-inline-start: 2px;
  opacity: 0.7;
}
.swap-cancel:hover {
  opacity: 1;
}

.swap-cancel-icon {
  font-size: 14px;
}

/* ── Main grid ────────────────────────────────────────────────────────────── */
.pitch-grid {
  display: grid;
  grid-template-rows: repeat(6, minmax(60px, auto));
  grid-template-columns: repeat(5, 1fr);
  gap: var(--slot-gap-mobile);
  min-height: 480px;
  position: relative;
  z-index: 1;
  justify-items: center;
  align-items: center;
}

/* ── Empty slot placeholder ───────────────────────────────────────────────── */
.pitch-slot-empty {
  gap: 4px;
  border: 1.5px dashed rgba(var(--ion-color-medium-rgb), 0.35);
  border-radius: 8px;
  width: min(100%, var(--node-size-mobile));
  min-height: var(--node-size-mobile);
  transition:
    border-color 180ms ease,
    background 180ms ease;
}

.pitch-grid :deep(.article-node) {
  width: min(100%, var(--node-size-mobile));
  min-width: 0;
  min-height: var(--node-size-mobile);
  padding: 6px 4px;
}

.slot-pos-label {
  font-size: 9px;
  color: var(--ion-color-medium);
  font-weight: 600;
}

.slot-add-icon {
  font-size: 14px;
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
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 14px;
  padding: 10px 12px;
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.18);
  border-radius: 10px;
  background: rgba(var(--ion-color-primary-rgb), 0.03);
}

.chem-item {
  margin: 0;
  --background: transparent;
  --border-width: 0;
  --box-shadow: none;
  --color: var(--ion-color-medium-shade);
  --border-radius: 999px;
  --padding-start: 8px;
  --padding-end: 8px;
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
  cursor: default;
}

.chem-item ion-label {
  font-size: 12px;
  font-weight: 600;
}

.chem-marker {
  display: inline-block;
  width: 14px;
  height: 4px;
  border-radius: 999px;
}

.chem-marker--excellent {
  background: #2f8f5b;
}

.chem-marker--good {
  background: #d6a71a;
}

.chem-marker--weak {
  background: #d46a17;
}

.chem-marker--empty {
  background: rgba(var(--ion-color-medium-rgb), 0.75);
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

@media (min-width: 768px) {
  .pitch {
    background: linear-gradient(
      to right,
      rgba(var(--ion-color-primary-rgb), 0.04) 0%,
      rgba(var(--ion-color-primary-rgb), 0.1) 50%,
      rgba(var(--ion-color-primary-rgb), 0.04) 100%
    );
    padding: 16px 12px;
  }

  .pitch-grid {
    grid-template-rows: repeat(5, minmax(64px, auto));
    grid-template-columns: repeat(6, minmax(80px, 1fr));
    min-height: 360px;
    gap: var(--slot-gap-desktop);
  }

  .pitch-slot-empty {
    width: min(100%, var(--node-size-desktop));
    min-height: var(--node-size-desktop);
  }

  .pitch-grid :deep(.article-node) {
    width: min(100%, var(--node-size-desktop));
    min-height: var(--node-size-desktop);
  }

  .pitch-center-line {
    top: 8px;
    bottom: 8px;
    left: 50%;
    right: auto;
    width: 1px;
    height: auto;
  }

  .pitch-goal {
    top: 50%;
    left: auto;
    transform: translateY(-50%);
    width: 28px;
    height: 40%;
  }

  .pitch-goal--top {
    left: 0;
    border-top: 1px solid rgba(var(--ion-color-primary-rgb), 0.18);
    border-left: none;
    border-radius: 0 6px 6px 0;
  }

  .pitch-goal--bottom {
    right: 0;
    bottom: auto;
    border-bottom: 1px solid rgba(var(--ion-color-primary-rgb), 0.18);
    border-right: none;
    border-radius: 6px 0 0 6px;
  }

  .chemistry-legend {
    padding: 10px 16px;
  }
}
</style>
