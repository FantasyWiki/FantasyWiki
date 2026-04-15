<template>
  <!--
    Plain <button> instead of <ion-button> to keep full control over
    dynamic class logic without Ionic's shadow DOM interfering.
  -->
  <button
    class="article-node"
    :class="{
      'article-node--gk': isGoalkeeper,
      'article-node--swap': swapMode,
      'article-node--dragover': isDragOver,
      'article-node--selected': selected,
    }"
    :aria-label="article.word"
    @click="$emit('click')"
    @dragstart="onDragStart"
    @dragover.prevent="isDragOver = true"
    @dragleave="isDragOver = false"
    @drop="onDrop"
  >
    <!-- Points delta badge (positive = green, negative = red) -->
    <span
      v-if="article.weeklyDelta !== undefined"
      class="article-delta"
      :class="{
        'article-delta--up': article.weeklyDelta > 0,
        'article-delta--down': article.weeklyDelta < 0,
      }"
    >
      {{ article.weeklyDelta > 0 ? "+" : "" }}{{ article.weeklyDelta }}
    </span>

    <span class="article-name">{{ article.word }}</span>
    <span class="article-pts">{{ article.points }} pts</span>

    <!-- GK label floats below the tile -->
    <span v-if="isGoalkeeper" class="gk-label">GK</span>
  </button>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { Contract } from "@/types/team";

const props = defineProps<{
  article: Contract;
  /** Renders the goalkeeper colour variant and GK label */
  isGoalkeeper?: boolean;
  /** When true, applies the pulsing ring to signal swap-target availability */
  swapMode?: boolean;
  /** Highlights the node as the currently selected swap source */
  selected?: boolean;
}>();

const emit = defineEmits<{
  /** Fired on click — parent decides whether to open detail dialog or enter swap mode */
  click: [];
  /** Fired when another article is dropped onto this node */
  swap: [fromId: number, toId: number];
}>();

const isDragOver = ref(false);

// ── HTML5 drag-and-drop ────────────────────────────────────────────────────
// NOTE: HTML5 drag events are unreliable on iOS Safari.
// When implementing touch support, replace with touchstart/touchmove/touchend
// or integrate vue-draggable-plus.

function onDragStart(e: DragEvent) {
  e.dataTransfer?.setData("articleId", String(props.article.id));
}

function onDrop(e: DragEvent) {
  isDragOver.value = false;
  const fromId = Number(e.dataTransfer?.getData("articleId"));
  if (fromId && fromId !== props.article.id) {
    emit("swap", fromId, props.article.id);
  }
}
</script>

<style scoped>
/* ── Base tile ──────────────────────────────────────────────────────────── */
.article-node {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 6px;
  border-radius: 8px;
  border: 2px solid var(--ion-border-color, rgba(0, 0, 0, 0.12));
  background: var(--ion-background-color);
  min-width: 56px;
  min-height: 56px;
  width: 100%;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    border-color 180ms ease;
  /* Reset browser button styles */
  font-family: inherit;
  outline: none;
  color: var(--ion-text-color);
}

.article-node:active {
  transform: scale(0.95);
}

/* ── Text content ──────────────────────────────────────────────────────── */
.article-name {
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70px;
  line-height: 1.3;
}

.article-pts {
  font-size: 10px;
  color: var(--ion-color-medium);
  margin-top: 2px;
}

/* ── Weekly delta badge ────────────────────────────────────────────────── */
.article-delta {
  position: absolute;
  top: 3px;
  right: 4px;
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
}

.article-delta--up {
  color: var(--ion-color-success, #2dd36f);
}
.article-delta--down {
  color: var(--ion-color-danger, #eb445a);
}

/* ── Goalkeeper variant ────────────────────────────────────────────────── */
.article-node--gk {
  background: linear-gradient(
    to bottom,
    rgba(var(--ion-color-primary-rgb), 0.2),
    rgba(var(--ion-color-primary-rgb), 0.05)
  );
  border-color: rgba(var(--ion-color-primary-rgb), 0.4);
}

.gk-label {
  position: absolute;
  bottom: -9px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  font-weight: 700;
  color: var(--ion-color-primary);
  background: var(--ion-background-color);
  padding: 0 4px;
  border-radius: 4px;
  pointer-events: none;
}

/* ── Selected (swap source) ────────────────────────────────────────────── */
.article-node--selected {
  border-color: var(--ion-color-warning);
  box-shadow: 0 0 0 2px var(--ion-color-warning);
}

/* ── Swap mode — pulsing ring on all eligible targets ─────────────────── */
.article-node--swap {
  box-shadow: 0 0 0 2px var(--ion-color-primary);
  animation: article-pulse 1.5s ease-in-out infinite;
}

/* ── Drag-over highlight ───────────────────────────────────────────────── */
.article-node--dragover {
  transform: scale(1.05);
  box-shadow: 0 0 0 2px rgba(var(--ion-color-secondary-rgb), 0.8);
  background: rgba(var(--ion-color-secondary-rgb), 0.12);
}

@keyframes article-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
</style>
