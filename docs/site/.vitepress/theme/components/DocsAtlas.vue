<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { withBase } from "vitepress";
import { colourFor, edges, labelFor, nodes, stats, type DocNode } from "../graph";
import { HEIGHT, WIDTH, boundsOf, layoutDocuments, type PlacedNode } from "../atlasLayout";

/**
 * The documentation, drawn as the graph it already is.
 *
 * Every edge here is a link somebody wrote in a markdown file — nothing is
 * curated for this view, and nothing can drift out of date, because the picture
 * is rebuilt from the docs on every deploy. Which is also what makes it useful
 * rather than decorative: a rule with no edges is a rule nobody found a reason
 * to reference, and that is worth seeing.
 *
 * Where the dots go is `../atlasLayout`; this file is the interaction around
 * them. Keeping the two apart is what lets the layout be run and measured
 * without a browser.
 */

/** The sections present in the tree, which is what the legend offers. */
const TYPES = [...new Set(nodes.map((node) => node.type))].sort((a, b) =>
  labelFor(a).localeCompare(labelFor(b), "en"),
);

const hidden = ref(new Set<string>());
const query = ref("");
const hovered = ref<string>();
const pinned = ref<string>();
const layout = shallowRef<PlacedNode[]>([]);
const view = ref({ x: 0, y: 0, w: WIDTH, h: HEIGHT });
const svg = ref<SVGSVGElement>();

const active = computed(() => pinned.value ?? hovered.value);

const visible = computed(() => {
  const term = query.value.trim().toLowerCase();
  return layout.value.filter((node) => {
    if (hidden.value.has(node.type)) return false;
    if (!term) return true;
    return (
      node.title.toLowerCase().includes(term) ||
      node.tags.some((tag) => tag.toLowerCase().includes(term)) ||
      node.summary.toLowerCase().includes(term)
    );
  });
});

const visibleIds = computed(() => new Set(visible.value.map((node) => node.id)));

const positions = computed(() => new Map(layout.value.map((node) => [node.id, node])));

const drawnEdges = computed(() =>
  edges
    .filter((edge) => visibleIds.value.has(edge.source) && visibleIds.value.has(edge.target))
    .map((edge) => {
      const from = positions.value.get(edge.source)!;
      const to = positions.value.get(edge.target)!;
      return { ...edge, x1: from.x, y1: from.y, x2: to.x, y2: to.y };
    }),
);

/** The hovered or pinned document, plus everything one hop away from it. */
const highlighted = computed(() => {
  if (!active.value) return undefined;
  const near = new Set<string>([active.value]);
  for (const edge of edges) {
    if (edge.source === active.value) near.add(edge.target);
    if (edge.target === active.value) near.add(edge.source);
  }
  return near;
});

const detail = computed(() => layout.value.find((node) => node.id === active.value));

const detailLinks = computed(() => {
  if (!detail.value) return { out: [] as DocNode[], in: [] as DocNode[] };
  const byId = new Map(layout.value.map((node) => [node.id, node]));
  return {
    out: edges
      .filter((edge) => edge.source === detail.value!.id)
      .map((edge) => byId.get(edge.target))
      .filter((node): node is PlacedNode => Boolean(node)),
    in: edges
      .filter((edge) => edge.target === detail.value!.id)
      .map((edge) => byId.get(edge.source))
      .filter((node): node is PlacedNode => Boolean(node)),
  };
});

function toggleType(type: string) {
  const next = new Set(hidden.value);
  if (next.has(type)) next.delete(type);
  else next.add(type);
  hidden.value = next;
}

function opacityFor(id: string) {
  if (!highlighted.value) return 1;
  return highlighted.value.has(id) ? 1 : 0.14;
}

function edgeOpacity(edge: { source: string; target: string; related: boolean }) {
  const base = edge.related ? 0.42 : 0.16;
  if (!highlighted.value) return base;
  return highlighted.value.has(edge.source) && highlighted.value.has(edge.target) ? 0.85 : 0.04;
}

/* ── Pan and zoom ──────────────────────────────────────────────────────── */

/**
 * How far the pointer may travel before the gesture counts as a pan rather than
 * a click. Below it a release still selects; above it the click that follows is
 * swallowed, because a drag that started on a dot should move the canvas.
 */
const DRAG_SLOP = 4;

let dragging: { x: number; y: number } | undefined;
const panned = ref(false);

function onWheel(event: WheelEvent) {
  event.preventDefault();
  const factor = event.deltaY > 0 ? 1.12 : 0.89;
  const w = Math.min(WIDTH * 1.6, Math.max(WIDTH * 0.35, view.value.w * factor));
  const h = w * (HEIGHT / WIDTH);
  view.value = {
    x: view.value.x + (view.value.w - w) / 2,
    y: view.value.y + (view.value.h - h) / 2,
    w,
    h,
  };
}

function onPointerDown(event: PointerEvent) {
  dragging = { x: event.clientX, y: event.clientY };
  panned.value = false;
}

function onPointerMove(event: PointerEvent) {
  if (!dragging || !svg.value) return;

  const dx = event.clientX - dragging.x;
  const dy = event.clientY - dragging.y;
  if (!panned.value && Math.hypot(dx, dy) < DRAG_SLOP) return;

  if (!panned.value) {
    panned.value = true;
    // Captured only once the gesture is definitely a pan, on the canvas rather
    // than on whatever is under the pointer — so a drag beginning on a dot
    // behaves like one beginning on empty space, and a pointer leaving the
    // frame keeps being tracked.
    //
    // Not on pointerdown, which is where it used to be: a captured pointer
    // dispatches its `click` at the capture target, so every click on a dot was
    // delivered to the canvas instead and nothing could be pinned.
    svg.value.setPointerCapture?.(event.pointerId);
  }

  const scale = view.value.w / svg.value.clientWidth;
  view.value = { ...view.value, x: view.value.x - dx * scale, y: view.value.y - dy * scale };
  dragging = { x: event.clientX, y: event.clientY };
}

function onPointerUp(event: PointerEvent) {
  dragging = undefined;
  if (svg.value?.hasPointerCapture?.(event.pointerId)) {
    svg.value.releasePointerCapture(event.pointerId);
  }
}

/** A release that panned the canvas is not a click on the dot it started over. */
function selectNode(id: string) {
  if (panned.value) return;
  pinned.value = pinned.value === id ? undefined : id;
}

function reset() {
  view.value = boundsOf(layout.value);
  pinned.value = undefined;
  query.value = "";
  hidden.value = new Set();
}

function onKey(event: KeyboardEvent) {
  if (event.key === "Escape") pinned.value = undefined;
}

onMounted(() => {
  layout.value = layoutDocuments(nodes, edges);
  view.value = boundsOf(layout.value);
  window.addEventListener("keydown", onKey);
});

onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

// A search that hides the pinned node would leave a detail panel describing
// something no longer on the canvas.
watch(visibleIds, (ids) => {
  if (pinned.value && !ids.has(pinned.value)) pinned.value = undefined;
});
</script>

<template>
  <div class="atlas">
    <div class="atlas__controls">
      <input
        v-model="query"
        class="atlas__search"
        type="search"
        placeholder="Filter by title, tag or opening line…"
        aria-label="Filter documents"
      />
      <button class="atlas__reset" type="button" @click="reset">Reset view</button>
    </div>

    <div class="atlas__legend" role="group" aria-label="Toggle sections">
      <button
        v-for="type in TYPES"
        :key="type"
        type="button"
        class="atlas__legend-item"
        :class="{ 'atlas__legend-item--off': hidden.has(type) }"
        :style="{ '--fw-chip-color': colourFor(type) }"
        :aria-pressed="!hidden.has(type)"
        @click="toggleType(type)"
      >
        <span class="atlas__swatch" :style="{ background: colourFor(type) }" />
        {{ labelFor(type) }}
        <span class="atlas__count">{{ nodes.filter((n) => n.type === type).length }}</span>
      </button>
    </div>

    <div class="atlas__stage">
      <svg
        ref="svg"
        class="atlas__canvas"
        :viewBox="`${view.x} ${view.y} ${view.w} ${view.h}`"
        role="application"
        aria-label="Force-directed map of the documentation"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="onPointerUp"
      >
        <g class="atlas__edges">
          <line
            v-for="(edge, i) in drawnEdges"
            :key="`e${i}`"
            :x1="edge.x1"
            :y1="edge.y1"
            :x2="edge.x2"
            :y2="edge.y2"
            :stroke-opacity="edgeOpacity(edge)"
            :stroke-dasharray="edge.related ? undefined : '3 4'"
          />
        </g>

        <g class="atlas__nodes">
          <g
            v-for="node in visible"
            :key="node.id"
            class="atlas__node"
            :class="{ 'atlas__node--active': active === node.id }"
            :opacity="opacityFor(node.id)"
            :transform="`translate(${node.x} ${node.y})`"
            @pointerenter="hovered = node.id"
            @pointerleave="hovered = undefined"
            @click="selectNode(node.id)"
          >
            <circle
              :r="node.radius"
              :fill="colourFor(node.type)"
              :stroke="colourFor(node.type)"
            />
            <text :y="node.radius + 14" text-anchor="middle">{{ node.label }}</text>
          </g>
        </g>
      </svg>

      <aside class="atlas__detail" :class="{ 'atlas__detail--empty': !detail }">
        <template v-if="detail">
          <span
            class="fw-chip"
            data-type
            :style="{ '--fw-chip-color': colourFor(detail.type) }"
          >
            {{ labelFor(detail.type) }}
          </span>
          <h3>{{ detail.title }}</h3>
          <p class="atlas__summary">{{ detail.summary }}</p>

          <dl class="atlas__facts">
            <div><dt>Links out</dt><dd>{{ detail.outbound }}</dd></div>
            <div><dt>Links in</dt><dd>{{ detail.inbound }}</dd></div>
            <div><dt>Words</dt><dd>{{ detail.words.toLocaleString("en-GB") }}</dd></div>
          </dl>

          <ul v-if="detail.tags.length" class="atlas__tags">
            <li v-for="tag in detail.tags" :key="tag">#{{ tag }}</li>
          </ul>

          <div v-if="detailLinks.out.length" class="atlas__list">
            <h4>Points to</h4>
            <button
              v-for="node in detailLinks.out"
              :key="`o-${node.id}`"
              type="button"
              @click="pinned = node.id"
            >
              <span class="fw-dot" :style="{ background: colourFor(node.type) }" />{{ node.title }}
            </button>
          </div>

          <div v-if="detailLinks.in.length" class="atlas__list">
            <h4>Pointed to by</h4>
            <button
              v-for="node in detailLinks.in"
              :key="`i-${node.id}`"
              type="button"
              @click="pinned = node.id"
            >
              <span class="fw-dot" :style="{ background: colourFor(node.type) }" />{{ node.title }}
            </button>
          </div>

          <a class="atlas__open" :href="withBase(detail.url)">Read this document →</a>
          <code class="atlas__source">{{ detail.source }}</code>
        </template>

        <template v-else>
          <span class="fw-eyebrow">The map</span>
          <p>
            {{ stats.documents }} documents joined by {{ stats.edges }} links, of which
            {{ stats.curated }} are curated <code>## Related</code> entries. Solid lines are
            curated; dashed lines are references made in passing.
          </p>
          <p class="atlas__hint">
            Hover a document to isolate its neighbourhood, click to pin it, scroll to zoom,
            drag to pan.
          </p>
          <div class="atlas__list">
            <h4>Most connected</h4>
            <button
              v-for="hub in stats.hubs"
              :key="hub.id"
              type="button"
              @click="pinned = hub.id"
            >
              {{ hub.title }}<span class="atlas__degree">{{ hub.degree }}</span>
            </button>
          </div>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.atlas {
  margin: 1.5rem 0 2rem;
}

.atlas__controls {
  display: flex;
  gap: 0.6rem;
  margin-bottom: 0.8rem;
}

.atlas__search {
  flex: 1;
  padding: 0.5rem 0.8rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--fw-radius-md);
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text-1);
  font-size: 0.88rem;
}

.atlas__search:focus {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -1px;
}

.atlas__reset {
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--fw-radius-md);
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text-2);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.atlas__reset:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.atlas__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.9rem;
}

.atlas__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  padding: 0.22rem 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text-2);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
}

.atlas__legend-item--off {
  opacity: 0.42;
}

.atlas__swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.atlas__count {
  color: var(--vp-c-text-3);
  font-weight: 400;
}

.atlas__stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 268px;
  gap: 0.9rem;
  align-items: stretch;

  /*
   * The row height is fixed rather than derived from what is in it, and that is
   * the whole fix for a flicker that took a while to name. The canvas is an SVG
   * with a viewBox: change the element's height and the drawing is
   * re-letterboxed inside it. Let the row follow the detail panel's content and
   * hovering a well-connected document grows the panel, shifts the map, moves
   * the dot out from under the pointer, and so drops the hover that caused it —
   * whereupon the panel empties, the row shrinks, and the dot comes back. The
   * map was fighting itself. Neither child may size this row.
   */
  grid-auto-rows: clamp(540px, 74vh, 860px);
}

.atlas__canvas {
  width: 100%;
  height: 100%;
  /* A grid item's default `min-height: auto` lets its content push the row
     taller than `grid-auto-rows` asked for. Both children opt out, or the row
     is only as fixed as its shortest day. */
  min-height: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--fw-radius-md);
  background:
    radial-gradient(circle at 30% 20%, var(--vp-c-bg-soft), transparent 60%),
    var(--vp-c-bg-elv);
  touch-action: none;
  cursor: grab;
}

.atlas__canvas:active {
  cursor: grabbing;
}

.atlas__edges line {
  stroke: var(--vp-c-text-3);
  stroke-width: 1.1;
}

.atlas__node {
  cursor: pointer;
  transition: opacity 0.18s ease;
}

.atlas__node circle {
  fill-opacity: 0.24;
  stroke-width: 1.8;
}

.atlas__node:hover circle,
.atlas__node--active circle {
  fill-opacity: 0.85;
}

.atlas__node text {
  /* Must match LABEL_SIZE in ../atlasLayout — the layout reserves room for
     these words, and it can only do that if it knows how big they are. */
  font-size: 10px;
  font-weight: 600;
  fill: var(--vp-c-text-2);
  pointer-events: none;
  paint-order: stroke;
  stroke: var(--vp-c-bg-elv);
  stroke-width: 3px;
  stroke-linejoin: round;
}

.atlas__node--active text {
  fill: var(--vp-c-text-1);
}

.atlas__detail {
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--fw-radius-md);
  background: var(--vp-c-bg-alt);
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  font-size: 0.85rem;
}

.atlas__detail h3 {
  margin: 0.5rem 0 0.35rem;
  font-family: "Libre Baskerville", Georgia, serif;
  font-size: 1rem;
  line-height: 1.3;
}

.atlas__summary {
  margin: 0 0 0.8rem;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}

.atlas__hint {
  color: var(--vp-c-text-3);
  font-size: 0.8rem;
}

.atlas__facts {
  display: flex;
  gap: 0.9rem;
  margin: 0 0 0.7rem;
}

.atlas__facts dt {
  font-size: 0.66rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.atlas__facts dd {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  font-family: "Libre Baskerville", Georgia, serif;
}

.atlas__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0 0 0.8rem;
  padding: 0;
  list-style: none;
  font-size: 0.72rem;
  color: var(--vp-c-text-3);
}

.atlas__list {
  margin-top: 0.8rem;
}

.atlas__list h4 {
  margin: 0 0 0.3rem;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.atlas__list button {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.16rem 0;
  border: 0;
  background: none;
  color: var(--vp-c-text-1);
  font-size: 0.82rem;
  text-align: left;
  cursor: pointer;
}

.atlas__list button:hover {
  color: var(--vp-c-brand-1);
}

.atlas__degree {
  margin-left: auto;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}

.atlas__open {
  display: inline-block;
  margin-top: 0.9rem;
  font-weight: 600;
}

.atlas__source {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.7rem;
  color: var(--vp-c-text-3);
  word-break: break-all;
}

.fw-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}

@media (max-width: 860px) {
  /* Stacked, the two are no longer siblings in one row, so the coupling that
     caused the shift cannot happen and each may size itself again. */
  .atlas__stage {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
  }

  .atlas__canvas {
    height: 62vh;
    min-height: 400px;
  }

  .atlas__detail {
    height: auto;
    max-height: none;
  }
}
</style>
