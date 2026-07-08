<template>
  <ion-card class="pitch-card">
    <div ref="pitchRef" class="pitch">
      <!-- Turf surface, clipped to the same trapezoid as the touchlines -->
      <div class="pitch-surface" aria-hidden="true" />
      <!-- ── Decorative pitch markings ──────────────────────────────────── -->
      <!--
        The pitch is drawn from behind the home goal: sidelines converge
        toward the far (top) goal and the mow stripes shorten with distance.
        preserveAspectRatio="none" stretches the drawing to the grid, so
        every stroke uses non-scaling-stroke to keep line widths crisp.
      -->
      <svg
        class="pitch-markings"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <clipPath :id="clipId">
            <polygon points="12.5,0 87.5,0 98.5,100 1.5,100" />
          </clipPath>
        </defs>
        <!-- Mow stripes, foreshortened toward the far goal -->
        <g class="pm-bands" :clip-path="`url(#${clipId})`">
          <rect x="0" y="10" width="100" height="11" />
          <rect x="0" y="33" width="100" height="13" />
          <rect x="0" y="60" width="100" height="15" />
          <rect x="0" y="91" width="100" height="9" />
        </g>
        <g class="pm-lines">
          <!-- Touchlines -->
          <polygon
            points="12.5,0 87.5,0 98.5,100 1.5,100"
            vector-effect="non-scaling-stroke"
          />
          <!-- Halfway line + center circle (squashed by perspective) -->
          <line
            x1="7.7"
            y1="44"
            x2="92.3"
            y2="44"
            vector-effect="non-scaling-stroke"
          />
          <ellipse
            cx="50"
            cy="44"
            rx="10.5"
            ry="5.5"
            vector-effect="non-scaling-stroke"
          />
          <!-- Far goal box -->
          <polyline
            points="35.7,0 34.9,9 65.1,9 64.3,0"
            vector-effect="non-scaling-stroke"
          />
          <!-- Near penalty area, goal box and arc -->
          <polyline
            points="22.9,100 24.1,80 75.9,80 77.1,100"
            vector-effect="non-scaling-stroke"
          />
          <polyline
            points="37.4,100 37.6,92 62.4,92 62.6,100"
            vector-effect="non-scaling-stroke"
          />
          <path
            d="M 41.5 80 Q 50 74.8 58.5 80"
            vector-effect="non-scaling-stroke"
          />
        </g>
      </svg>

      <!-- ── Swap-mode banner ───────────────────────────────────────────── -->
      <transition name="fade">
        <div v-if="swapMode && swapSource" class="swap-banner fm-center-row">
          <ion-icon :icon="swapHorizontalOutline" />
          <span>
            {{ $t("formation.pitch.swapInstruction") }}
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

      <!-- ── Chemistry links ────────────────────────────────────────────── -->
      <svg
        class="chemistry-lines"
        :viewBox="`0 0 ${viewBox.width} ${viewBox.height}`"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          v-for="line in chemistryLines"
          :key="line.key"
          class="chem-line"
          :class="`chem-line--${line.level}`"
          :x1="line.x1"
          :y1="line.y1"
          :x2="line.x2"
          :y2="line.y2"
          vector-effect="non-scaling-stroke"
        />
      </svg>

      <!-- ── Main grid ──────────────────────────────────────────────────── -->
      <div class="pitch-grid" role="grid" aria-label="Formation grid">
        <template v-for="posKey in activePositions" :key="posKey">
          <!-- Filled slot -->
          <ArticleNode
            v-if="formation.formation[posKey]"
            :article="formation.formation[posKey]!"
            :swap-mode="
              swapMode && formation.formation[posKey]?.id !== swapSource?.id
            "
            :selected="formation.formation[posKey]?.id === swapSource?.id"
            :style="gridStyle(posKey)"
            :data-position="posKey"
            @click="$emit('articleClick', formation.formation[posKey]!)"
            @swap="(fromId, toId) => $emit('swap', fromId, toId)"
          />

          <!-- Empty / unfilled slot -->
          <div
            v-else
            class="pitch-slot-empty fm-center-col"
            :style="gridStyle(posKey)"
            :class="{
              'pitch-slot-empty--swap': swapMode,
              'pitch-slot-empty--dragover': dragOverPos === posKey,
            }"
            :aria-label="`Empty position ${posKey}`"
            :data-position="posKey"
            @click="onEmptySlotClick(posKey)"
            @dragover.prevent="dragOverPos = posKey"
            @dragleave="dragOverPos = null"
            @drop="onEmptyDrop($event, posKey)"
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
          class="chem-marker ion-margin-end"
          :class="{
            'chem-marker--excellent': item.level === 'excellent',
            'chem-marker--good': item.level === 'good',
            'chem-marker--weak': item.level === 'weak',
            'chem-marker--empty': item.level === 'empty',
          }"
          aria-hidden="true"
        />
        <ion-label> {{ item.label }}</ion-label>
      </ion-chip>
    </div>
  </ion-card>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
  nextTick,
} from "vue";
import {
  IonButton,
  IonCard,
  IonChip,
  IonIcon,
  IonLabel,
  onIonViewDidEnter,
} from "@ionic/vue";
import {
  swapHorizontalOutline,
  addCircleOutline,
  closeOutline,
} from "ionicons/icons";
import { POSITION_MAP, FORMATIONS, PITCH_GRID } from "@/types/pitch";
import {
  ChemistryLevel,
  DraftFormationDTO,
  Position,
} from "../../../../dto/formationDTO";
import type { ContractDTO } from "../../../../dto/contractDTO";
import ArticleNode from "./ArticleNode.vue";
import { useI18n } from "vue-i18n";

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
  moveToEmpty: [fromId: string, posKey: string];
  /** User dismissed the swap banner */
  cancelSwap: [];
}>();
const { t } = useI18n();

// Ionic can keep several cached views (each with its own pitch) mounted at
// once, so the SVG clipPath id must be unique per component instance.
const clipId = `pitch-clip-${useId()}`;

const dragOverPos = ref<string | null>(null);

function onEmptyDrop(e: DragEvent, posKey: string) {
  dragOverPos.value = null;
  const fromId = e.dataTransfer?.getData("articleId");
  if (fromId) emit("moveToEmpty", fromId, posKey);
}

function onEmptySlotClick(posKey: string) {
  if (props.swapMode && props.swapSource) {
    emit("moveToEmpty", props.swapSource.id, posKey);
  }
}

const chemistryLegendItems = computed(
  () =>
    [
      { level: "excellent", label: t("formation.pitch.chemistry.excellent") },
      { level: "good", label: t("formation.pitch.chemistry.good") },
      { level: "weak", label: t("formation.pitch.chemistry.weak") },
      { level: "empty", label: t("formation.pitch.chemistry.empty") },
    ] as const
);

const pitchRef = ref<HTMLElement | null>(null);
let pitchObserver: ResizeObserver | null = null;

onMounted(() => {
  pitchObserver = new ResizeObserver(() => {
    updateAnchors();
  });
  if (pitchRef.value) {
    pitchObserver.observe(pitchRef.value);
  }
  updateAnchors();
  void nextTick(updateAnchors);
});

onBeforeUnmount(() => {
  pitchObserver?.disconnect();
});

// Ionic caches views in ion-router-outlet, so onMounted only fires on the
// first visit. Re-measure anchors every time the view becomes visible so
// chemistry lines are drawn with the correct coordinates.
onIonViewDidEnter(() => {
  void nextTick(updateAnchors);
});

/** Positions required by the current schema */
const activePositions = computed(
  () => FORMATIONS[props.formation.schema] ?? []
);

/**
 * Returns inline CSS grid-placement styles for the given position key.
 * CSS grid is 1-indexed; POSITION_MAP uses 0-indexed values.
 *
 * --fm-col-offset / --fm-depth feed the perspective convergence in CSS:
 * outer columns drift toward the center as rows recede to the far goal
 * (row 0 = attack = deepest, last row = goalkeeper = camera plane).
 */
function gridStyle(posKey: Position): Record<string, string> {
  const pos = POSITION_MAP[posKey];
  if (!pos) return {};

  const lastRow = PITCH_GRID.rows - 1;
  const centerCol = (PITCH_GRID.cols - 1) / 2;
  return {
    gridRow: String(pos.row + 1),
    gridColumn: String(pos.col + 1),
    "--fm-col-offset": String(pos.col - centerCol),
    "--fm-depth": String((lastRow - pos.row) / lastRow),
  };
}

type RenderedChemistryLine = {
  key: string;
  level: ChemistryLevel;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const viewBox = ref({ width: 1, height: 1 });
const anchorMap = ref<Record<string, { x: number; y: number }>>({});

function updateAnchors(): void {
  if (!pitchRef.value) return;
  const pitchRect = pitchRef.value.getBoundingClientRect();
  const width = pitchRect.width || 1;
  const height = pitchRect.height || 1;
  viewBox.value = { width, height };

  const anchors: Record<string, { x: number; y: number }> = {};
  pitchRef.value
    .querySelectorAll<HTMLElement>("[data-position]")
    .forEach((el) => {
      const posKey = el.dataset.position;
      if (!posKey) return;
      const rect = el.getBoundingClientRect();
      anchors[posKey] = {
        x: rect.left + rect.width / 2 - pitchRect.left,
        y: rect.top + rect.height / 2 - pitchRect.top,
      };
    });

  anchorMap.value = anchors;
}

watch(
  () => props.formation.schema,
  async () => {
    await nextTick();
    updateAnchors();
  }
);

watch(
  () => props.formation.formation,
  async () => {
    await nextTick();
    updateAnchors();
  },
  { deep: true }
);

const chemistryLines = computed<RenderedChemistryLine[]>(() => {
  return props.formation.chemistry
    .map((link) => {
      const from = anchorMap.value[link.from];
      const to = anchorMap.value[link.to];
      if (!from || !to) return null;

      // A link only carries a real chemistry level when both of its endpoint
      // positions are filled; if either slot is empty the line renders neutral
      // (empty) regardless of any stale level still on the link.
      const bothFilled =
        !!props.formation.formation[link.from] &&
        !!props.formation.formation[link.to];

      return {
        key: `${link.from}-${link.to}`,
        level: bothFilled ? link.level : ChemistryLevel.EMPTY,
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
      };
    })
    .filter((line): line is RenderedChemistryLine => line !== null);
});
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
  /* The pitch is portrait everywhere; cap its width so it never sprawls
     across a wide viewport, mirroring a console team-management screen. */
  width: 100%;
  max-width: 680px;
  margin-inline: auto;
}

/* ── Pitch background ─────────────────────────────────────────────────────── */
.pitch {
  position: relative;
  /* Grow with the card so hosts can equal-height the pitch against
     neighboring columns; the fr-based grid rows absorb the extra space. */
  flex: 1;
  display: flex;
  flex-direction: column;
  /* 1cqw = 1% of the pitch width, used for perspective convergence */
  container-type: inline-size;
  --slot-gap-mobile: 14px;
  --slot-gap-desktop: 18px;
  --node-size-mobile: 48px;
  --node-size-desktop: 56px;
  --pitch-pad-top: 16px;
  --pitch-pad-x: 8px;
  --pitch-pad-bottom: 24px;
  overflow: visible;
  padding: var(--pitch-pad-top) var(--pitch-pad-x) var(--pitch-pad-bottom);
}

/* Turf fill: no card box, just the trapezoid floating on the page.
   Deeper tint at the far goal sells the distance. */
.pitch-surface {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  clip-path: polygon(12.5% 0, 87.5% 0, 98.5% 100%, 1.5% 100%);
  background: linear-gradient(
    to bottom,
    rgba(var(--ion-color-primary-rgb), 0.18) 0%,
    rgba(var(--ion-color-primary-rgb), 0.1) 45%,
    rgba(var(--ion-color-primary-rgb), 0.07) 100%
  );
}

/* ── Pitch markings (perspective SVG) ────────────────────────────────────── */
.pitch-markings {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}

.pm-bands rect {
  fill: rgba(var(--ion-color-primary-rgb), 0.05);
}

.pm-lines polygon,
.pm-lines line,
.pm-lines ellipse,
.pm-lines polyline,
.pm-lines path {
  fill: none;
  stroke: rgba(var(--ion-color-primary-rgb), 0.28);
  stroke-width: 1.5px;
}

/* ── Chemistry links ─────────────────────────────────────────────────────── */
.chemistry-lines {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  width: 100%;
  height: 100%;
}

.chem-line {
  stroke-width: 2.5px;
  stroke-linecap: round;
  opacity: 0.85;
}

.chem-line--excellent {
  stroke: #2f8f5b;
}

.chem-line--good {
  stroke: #d6a71a;
}

.chem-line--weak {
  stroke: #d42a17;
}

.chem-line--empty {
  stroke-width: 2px;
  stroke: rgba(var(--ion-color-medium-rgb), 0.75);
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
  /* Rows taper toward the far goal: the squashed perspective look */
  grid-template-rows: 0.82fr 0.9fr 0.98fr 1.06fr 1.12fr 1fr;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--slot-gap-mobile);
  min-height: 460px;
  flex: 1;
  position: relative;
  z-index: 1;
  justify-items: center;
  align-items: center;
}

/*
 * Perspective convergence: nodes in outer columns slide toward the center
 * line as their row recedes (see gridStyle). Uses the standalone `translate`
 * property so it composes with the `transform` scale on :active/drag-over,
 * and cqw units so the shift is proportional to the pitch width. Chemistry
 * anchors stay correct: they are measured from post-translate rects.
 */
.pitch-grid :deep(.article-node),
.pitch-slot-empty {
  translate: calc(var(--fm-col-offset, 0) * var(--fm-depth, 0) * -4.5cqw) 0;
}

/* ── Empty slot placeholder ───────────────────────────────────────────────── */
.pitch-slot-empty {
  gap: 4px;
  border: 1.5px dashed rgba(var(--ion-color-medium-rgb), 0.35);
  border-radius: 8px;
  width: min(100%, var(--node-size-mobile));
  min-height: var(--node-size-mobile);
  background: rgba(var(--ion-background-color-rgb), 0.5);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
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

.pitch-slot-empty--dragover {
  transform: scale(1.05);
  border-color: var(--ion-color-secondary);
  background: rgba(var(--ion-color-secondary-rgb), 0.12);
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
  width: 28px;
  height: 4px;
  border-radius: 700px;
}

.chem-marker--excellent {
  background: #2f8f5b;
}

.chem-marker--good {
  background: #d6a71a;
}

.chem-marker--weak {
  background: #d42a17;
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
    --pitch-pad-x: 12px;
    --pitch-pad-bottom: 20px;
  }

  .pitch-grid {
    min-height: 540px;
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

  .chemistry-legend {
    padding: 10px 16px;
  }
}
</style>
