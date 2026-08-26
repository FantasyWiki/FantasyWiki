<script lang="ts">
/**
 * Everything shared by the figures on a page lives here, in a plain `<script>`
 * block, and it has to.
 *
 * `<script setup>` has no module scope: every top-level statement in it is
 * compiled into the body of `setup()` and therefore runs once **per instance**.
 * A counter declared there is not a counter — it is one counter each, all
 * starting at zero, so every diagram on the page is rendered under the same id.
 * Mermaid then finds the first element with that id, and the figures overwrite
 * each other: one ends up holding two diagrams, the rest hold nothing. That was
 * a real bug, and this comment is here so it does not come back.
 */

const LIGHT = {
  background: "#ffffff",
  primaryColor: "#e8f2ec",
  primaryTextColor: "#171f1b",
  primaryBorderColor: "#1e7e50",
  secondaryColor: "#fdf3d6",
  secondaryBorderColor: "#d8b03a",
  tertiaryColor: "#f0f5f0",
  tertiaryBorderColor: "#cdd8cd",
  lineColor: "#5f6f62",
  textColor: "#171f1b",
  mainBkg: "#e8f2ec",
  nodeBorder: "#1e7e50",
  clusterBkg: "#f7f9f6",
  clusterBorder: "#cdd8cd",
  edgeLabelBackground: "#ffffff",
  actorBkg: "#e8f2ec",
  actorBorder: "#1e7e50",
  noteBkgColor: "#fdf3d6",
  noteBorderColor: "#d8b03a",
  noteTextColor: "#171f1b",
};

const DARK = {
  background: "#1a221d",
  primaryColor: "#1c3d2d",
  primaryTextColor: "#f0f0ed",
  primaryBorderColor: "#3ab87a",
  secondaryColor: "#3b3320",
  secondaryBorderColor: "#f5c842",
  tertiaryColor: "#16231c",
  tertiaryBorderColor: "#2c4033",
  lineColor: "#8aa294",
  textColor: "#f0f0ed",
  mainBkg: "#1c3d2d",
  nodeBorder: "#3ab87a",
  clusterBkg: "#141f19",
  clusterBorder: "#2c4033",
  edgeLabelBackground: "#1a221d",
  actorBkg: "#1c3d2d",
  actorBorder: "#3ab87a",
  noteBkgColor: "#3b3320",
  noteBorderColor: "#f5c842",
  noteTextColor: "#f0f0ed",
};

/** Unique per diagram in the document, because the SVG keeps it and its own
 * stylesheet is scoped to it. */
let counter = 0;

/** Imported once for the whole page, not once per figure. */
let library: Promise<typeof import("mermaid").default> | undefined;

/**
 * Diagrams render one at a time, whatever order they mounted in. `mermaid`
 * configures a module global and draws through a scratch element it attaches
 * to the document, neither of which survives two calls in flight at once —
 * and every figure on a page mounts in the same tick.
 */
let queue: Promise<unknown> = Promise.resolve();

/**
 * How far a diagram may be scaled down to fit the column before its labels stop
 * being readable.
 *
 * Mermaid asks for `width="100%"` with the natural width as a maximum, so a
 * 1,600-unit diagram in a 650px column renders at 40% and 17px type arrives as
 * seven. Below the floor the figure scrolls instead — `.fw-mermaid` is already
 * an `overflow-x: auto` container — because a diagram you have to nudge sideways
 * beats one you have to squint at.
 */
const MIN_SCALE = 0.72;

/** Adds that floor to the SVG mermaid just produced. */
function withLegibleFloor(svg: string): string {
  const natural = /<svg[^>]*viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/.exec(svg);
  if (!natural) return svg;
  const width = Math.round(Number(natural[1]) * MIN_SCALE);
  return svg.replace(
    /^(<svg[^>]*?)style="([^"]*)"/,
    (_match, before, style) => `${before}style="${style};min-width:${width}px"`,
  );
}

function renderDiagram(graph: string, dark: boolean) {
  const id = `fw-diagram-${(counter += 1)}`;

  const job = queue.then(async () => {
    library ??= import("mermaid").then((module) => module.default);
    const mermaid = await library;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily: '"Source Sans 3", -apple-system, sans-serif',
      themeVariables: { ...(dark ? DARK : LIGHT), fontSize: "17px" },
      flowchart: { curve: "basis", htmlLabels: true, padding: 12 },
      // Narrow gutters between actors: a sequence diagram's width is almost
      // entirely this number times the participant count, and width is what
      // decides how far the whole thing has to be scaled down to fit.
      sequence: { actorMargin: 24, boxMargin: 8, mirrorActors: false },
      gantt: { fontSize: 12 },
    });

    const { svg } = await mermaid.render(id, graph);
    return { svg: withLegibleFloor(svg) };
  });

  // The queue has to survive a diagram that throws, or one bad fence stops
  // every figure below it from ever drawing.
  queue = job.then(
    () => undefined,
    () => undefined,
  );

  return job;
}
</script>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useData } from "vitepress";

/**
 * Renders a ```mermaid fence, in the app's colours.
 *
 * Diagrams are theme-aware because the site is: a diagram whose boxes stay
 * paper-white in dark mode is the one thing on the page that looks broken. The
 * source arrives base64-encoded from the markdown-it rule in `config.mts`,
 * which is how quotes and newlines survive the trip through a Vue prop.
 */
const props = defineProps<{ graph: string }>();

const { isDark } = useData();
const container = ref<HTMLElement>();
const error = ref<string>();
const rendered = ref("");

const source = computed(() =>
  new TextDecoder().decode(Uint8Array.from(atob(props.graph), (c) => c.charCodeAt(0))),
);

async function draw() {
  const graph = source.value;
  const dark = isDark.value;

  try {
    rendered.value = (await renderDiagram(graph, dark)).svg;
    error.value = undefined;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
    rendered.value = "";
  }
}

onMounted(draw);
watch(isDark, draw);
</script>

<template>
  <figure
    ref="container"
    class="fw-mermaid"
    :class="{ 'fw-mermaid--error': error }"
    role="img"
  >
    <div v-if="rendered" v-html="rendered" />
    <template v-else-if="error">
      <p><strong>This diagram failed to render.</strong></p>
      <pre>{{ error }}</pre>
      <pre>{{ source }}</pre>
    </template>
    <p v-else class="fw-mermaid__pending">Rendering diagram…</p>
  </figure>
</template>

<style scoped>
.fw-mermaid__pending {
  margin: 0;
  color: var(--vp-c-text-3);
  font-size: 0.85rem;
}
</style>
