<script setup lang="ts">
import { computed } from "vue";
import { useData, withBase } from "vitepress";
import { colourFor, labelFor, neighboursOf, nodeById } from "../graph";

/**
 * The other half of the graph, shown at the foot of every document.
 *
 * A `## Related` list tells a reader where to go next. It cannot tell them who
 * depends on the page they are on — that edge is only visible from the other
 * end. This panel closes the loop, and it costs nothing to maintain: the data
 * is read back out of the links the docs already contain.
 */
const { frontmatter, page } = useData();

// `relativePath` is the mirrored file's path inside `site/`, which is exactly
// the id `prepare.mjs` gave the node. Matching on it avoids reasoning about
// where `base` starts and the route ends.
const current = computed(() => nodeById(page.value.relativePath));
const neighbours = computed(() => (current.value ? neighboursOf(current.value.id) : []));
const outgoing = computed(() => neighbours.value.filter((n) => n.direction === "out"));
const incoming = computed(() => neighbours.value.filter((n) => n.direction === "in"));

const updated = computed(() => {
  const value = frontmatter.value.updated;
  if (typeof value !== "string") return undefined;
  // Pinned to UTC so the server-rendered date and the browser's agree; without
  // it a reader west of UTC hydrates a different day than the HTML carries.
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
});
</script>

<template>
  <aside v-if="current && neighbours.length" class="fw-neighbourhood">
    <header class="fw-neighbourhood__head">
      <span class="fw-eyebrow">Neighbourhood</span>
      <a class="fw-neighbourhood__atlas" :href="withBase('/#the-docs-atlas')">
        Open in the Atlas →
      </a>
    </header>

    <div class="fw-neighbourhood__columns">
      <section v-if="outgoing.length">
        <h4>This page points to</h4>
        <ul>
          <li v-for="{ node, related } in outgoing" :key="`out-${node.id}`">
            <a :href="withBase(node.url)">
              <span class="fw-dot" :style="{ background: colourFor(node.type) }" />
              {{ node.title }}
            </a>
            <span v-if="related" class="fw-neighbourhood__flag" title="Listed under ## Related">
              curated
            </span>
          </li>
        </ul>
      </section>

      <section v-if="incoming.length">
        <h4>Pages that point here</h4>
        <ul>
          <li v-for="{ node } in incoming" :key="`in-${node.id}`">
            <a :href="withBase(node.url)">
              <span class="fw-dot" :style="{ background: colourFor(node.type) }" />
              {{ node.title }}
            </a>
            <span class="fw-chip" :style="{ '--fw-chip-color': colourFor(node.type) }" data-type>
              {{ labelFor(node.type) }}
            </span>
          </li>
        </ul>
      </section>
    </div>

    <p v-if="updated" class="fw-neighbourhood__meta">
      Source: <code>{{ current.source }}</code> · last changed {{ updated }}
    </p>
  </aside>
</template>

<style scoped>
.fw-neighbourhood {
  margin-top: 3rem;
  padding: 1.2rem 1.3rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--fw-radius-md);
  background: var(--vp-c-bg-alt);
}

.fw-neighbourhood__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.9rem;
}

.fw-neighbourhood__atlas {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.fw-neighbourhood__atlas:hover {
  text-decoration: underline;
}

.fw-neighbourhood__columns {
  display: grid;
  gap: 1rem 2rem;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
}

.fw-neighbourhood h4 {
  margin: 0 0 0.45rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.fw-neighbourhood ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.fw-neighbourhood li {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.16rem 0;
  font-size: 0.88rem;
  line-height: 1.4;
}

.fw-neighbourhood a {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--vp-c-text-1);
  text-decoration: none;
  font-weight: 500;
}

.fw-neighbourhood a:hover {
  color: var(--vp-c-brand-1);
}

.fw-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}

.fw-neighbourhood__flag {
  font-size: 0.66rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.fw-neighbourhood__meta {
  margin: 1rem 0 0;
  padding-top: 0.7rem;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 0.76rem;
  color: var(--vp-c-text-3);
}

.fw-neighbourhood__meta code {
  font-size: 0.74rem;
  background: transparent;
  padding: 0;
}
</style>
