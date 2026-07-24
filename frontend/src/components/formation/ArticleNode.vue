<template>
  <!--
    Plain <button> instead of <ion-button> to keep full control over
    dynamic class logic without Ionic's shadow DOM interfering.
  -->
  <button
    ref="nodeRef"
    class="article-node fm-center-col"
    :class="{
      'article-node--swap': swapMode,
      'article-node--dragover': isDragOver,
      'article-node--selected': selected,
    }"
    :aria-label="article.article.title"
    :data-article-id="article.id"
    :draggable="editable"
    @click="onClick"
    @dragstart="onDragStart"
    @dragover.prevent="isDragOver = true"
    @dragleave="isDragOver = false"
    @drop="onDrop"
  >
    <span class="article-name fm-text-truncate">{{
      article.article.title
    }}</span>
    <span class="article-tier" :class="`tier--${article.tier.toLowerCase()}`">
      {{ article.tier }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { ContractDTO } from "../../../../dto/contractDTO";
import { useTouchDragDrop } from "@/composables/useTouchDragDrop";

const props = withDefaults(
  defineProps<{
    /** The contract to display in this slot */
    article: ContractDTO;
    /** When true, applies the pulsing ring to signal swap-target availability */
    swapMode?: boolean;
    /** Highlights the node as the currently selected swap source */
    selected?: boolean;
    /** False on read-only hosts (e.g. the dashboard preview) to disable drag-to-move */
    editable?: boolean;
  }>(),
  { editable: true }
);

const emit = defineEmits<{
  /** Fired on click — parent decides whether to open detail dialog or enter swap mode */
  click: [];
  /** Fired when another article is dropped onto this node */
  swap: [fromId: string, toId: string];
  /** Fired when this article is dropped onto an empty pitch slot */
  dropOnEmpty: [fromId: string, posKey: string];
}>();

const isDragOver = ref(false);

// ── HTML5 drag-and-drop (mouse/desktop) ─────────────────────────────────────
// NOTE: HTML5 drag events are unreliable on touch devices, hence useTouchDragDrop
// below for the long-press-and-drag path phones actually use.

function onDragStart(e: DragEvent) {
  e.dataTransfer?.setData("articleId", props.article.id);
}

function onDrop(e: DragEvent) {
  isDragOver.value = false;
  const fromId = e.dataTransfer?.getData("articleId");
  if (fromId && fromId !== props.article.id) {
    emit("swap", fromId, props.article.id);
  }
}

// ── Touch long-press-and-drag ────────────────────────────────────────────────
const nodeRef = ref<HTMLButtonElement | null>(null);

// A drag that actually moved suppresses the trailing synthetic click itself
// (that's what the touchmove preventDefault is for), so no click ever arrives
// to clear a "just dragged" flag set on drop — it would stick forever and eat
// the next real tap on this slot. A short time window after the drop is used
// instead: any click within it is the (possible) stray synthetic one, and any
// later click is a genuine, unrelated tap.
const DRAG_CLICK_SUPPRESS_MS = 400;
let lastDropAt = 0;

useTouchDragDrop(nodeRef, {
  articleId: () => props.article.id,
  disabled: () => !props.editable,
  onDrop: (decision) => {
    lastDropAt = performance.now();
    if (decision.kind === "swap") {
      emit("swap", props.article.id, decision.targetId);
    } else if (decision.kind === "moveToEmpty") {
      emit("dropOnEmpty", props.article.id, decision.position);
    }
  },
});

function onClick() {
  if (performance.now() - lastDropAt < DRAG_CLICK_SUPPRESS_MS) return;
  emit("click");
}
</script>

<style scoped src="src/components/formation/formation-shared.css"></style>

<style scoped>
/* ── Base tile ──────────────────────────────────────────────────────────── */
.article-node {
  position: relative;
  padding: 8px 6px;
  border-radius: 8px;
  border: 2px solid var(--ion-border-color, rgba(0, 0, 0, 0.12));
  background: var(--ion-background-color);
  min-width: 56px;
  min-height: 56px;
  width: 100%;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  /* A long press must lift the tile, not trigger iOS's selection callout. */
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
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
  max-width: 70px;
  line-height: 1.3;
}

@media (min-width: 768px) {
  .article-name {
    max-width: 84px;
  }
}

/* ── Tier badge ────────────────────────────────────────────────────────── */
.article-tier {
  font-size: 9px;
  font-weight: 700;
  margin-top: 3px;
  padding: 1px 5px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tier--short {
  background: rgba(var(--ion-color-warning-rgb), 0.2);
  color: var(--ion-color-warning);
}

.tier--medium {
  background: rgba(var(--ion-color-primary-rgb), 0.15);
  color: var(--ion-color-primary);
}

.tier--long {
  background: rgba(var(--ion-color-success-rgb), 0.15);
  color: var(--ion-color-success);
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

/* ── Touch drag source — dims while its floating clone follows the finger ── */
.article-node--drag-source {
  opacity: 0.35;
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
