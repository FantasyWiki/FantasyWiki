<script setup lang="ts">
import { computed } from "vue";
import { withBase } from "vitepress";
import api from "@generated/api.json";

/**
 * The HTTP surface, counted out of `backend/openapi.yaml` at build time.
 *
 * Every figure here is derived, for the same reason the coverage board reads
 * the real reports: a number typed into a page is a number that will be wrong.
 * And nothing can be missing from it — the backend suite compares the spec with
 * the Worker's own route table, so an endpoint that is not described never
 * reaches a build.
 */

interface Group {
  name: string;
  operations: number;
  methods: Record<string, number>;
}

interface Regime {
  id: string;
  prefix: string;
  note: string;
  operations: number;
}

interface Api {
  present: boolean;
  version?: string | null;
  openapi?: string | null;
  operations?: number;
  paths?: number;
  schemas?: number;
  methods?: Record<string, number>;
  groups?: Group[];
  regimes?: Regime[];
}

const spec = api as Api;

/**
 * The method palette, taken from the section colours the Atlas and the sidebar
 * already use. Reusing them rather than inventing a set means the board follows
 * the theme in both modes and adds no colour to the site.
 */
const METHOD_COLOUR: Record<string, string> = {
  GET: "var(--fw-type-architecture)",
  POST: "var(--fw-type-domain)",
  PUT: "var(--fw-type-adr)",
  PATCH: "var(--fw-type-agents)",
  DELETE: "var(--fw-type-deployment)",
};

const REGIME_COLOUR: Record<string, string> = {
  session: "var(--fw-type-domain)",
  service: "var(--fw-type-adr)",
  open: "var(--fw-type-guide)",
};

const ORDER = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const total = computed(() => spec.operations ?? 0);
const groups = computed(() => spec.groups ?? []);
const regimes = computed(() => (spec.regimes ?? []).filter((regime) => regime.operations > 0));

/** Methods in a fixed order, so the legend and every bar read left to right the same way. */
const methods = computed(() =>
  ORDER.filter((method) => (spec.methods?.[method] ?? 0) > 0).map((method) => ({
    method,
    count: spec.methods?.[method] ?? 0,
    colour: METHOD_COLOUR[method],
  })),
);

/**
 * Where a group sits on the reference. Swagger UI's deep links name a tag with
 * its spaces underscored, so "Article Genie" is `#/Article_Genie` — a card is
 * therefore a way into that section rather than just a count of it.
 */
function linkTo(tag: string) {
  return withBase(`/api.html#/${tag.replace(/ /g, "_")}`);
}

function segments(counts: Record<string, number>, of: number) {
  return ORDER.filter((method) => counts[method]).map((method) => ({
    method,
    count: counts[method],
    colour: METHOD_COLOUR[method],
    width: `${(counts[method] / of) * 100}%`,
  }));
}
</script>

<template>
  <div v-if="spec.present" class="api">
    <header class="api__summary">
      <div class="api__figure">
        <strong>{{ total }}</strong>
        <span>endpoints</span>
      </div>

      <div class="api__body">
        <span class="fw-eyebrow">OpenAPI {{ spec.openapi }} · v{{ spec.version }}</span>
        <p class="api__lead">
          Across <strong>{{ spec.paths }}</strong> paths and
          <strong>{{ spec.schemas }}</strong> schemas, grouped into
          <strong>{{ groups.length }}</strong> areas of the game. Which
          authentication applies is decided by the path prefix, not by the
          endpoint.
        </p>

        <div class="api__regimes">
          <div
            v-for="regime in regimes"
            :key="regime.id"
            class="api__regime"
            :style="{ '--api-colour': REGIME_COLOUR[regime.id] }"
          >
            <code>{{ regime.prefix }}</code>
            <span class="api__regime-count">{{ regime.operations }}</span>
            <span class="api__regime-note">{{ regime.note }}</span>
          </div>
        </div>

        <p class="api__meta">
          Counted from <code>backend/openapi.yaml</code> when this page was
          built, and gated against the Worker's own route table by the backend
          suite.
        </p>
      </div>
    </header>

    <ul class="api__legend">
      <li v-for="entry in methods" :key="entry.method" :style="{ '--api-colour': entry.colour }">
        <span class="api__swatch" />{{ entry.method }}
        <small>{{ entry.count }}</small>
      </li>
    </ul>

    <div class="api__groups">
      <a
        v-for="group in groups"
        :key="group.name"
        class="fw-card api__group"
        :href="linkTo(group.name)"
      >
        <div class="api__group-head">
          <h3>{{ group.name }}</h3>
          <span class="api__count">{{ group.operations }}</span>
        </div>
        <div
          class="api__bar"
          role="img"
          :aria-label="`${group.operations} endpoints in ${group.name}`"
        >
          <span
            v-for="segment in segments(group.methods, group.operations)"
            :key="segment.method"
            :title="`${segment.method} ${segment.count}`"
            :style="{ width: segment.width, background: segment.colour }"
          />
        </div>
      </a>
    </div>
  </div>

  <p v-else class="api__absent">
    No specification was published with this build, so the surface is unknown.
  </p>
</template>

<style scoped>
.api {
  margin: 1.5rem 0;
}

.api__summary {
  display: flex;
  align-items: stretch;
  gap: 1.4rem;
  padding: 1.2rem 1.4rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--fw-radius-md);
  background: var(--vp-c-bg-alt);
  margin-bottom: 1rem;
}

.api__figure {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 118px;
  border-right: 1px solid var(--vp-c-divider);
  padding-right: 1.4rem;
}

.api__figure strong {
  font-family: "Libre Baskerville", Georgia, serif;
  font-size: 2.6rem;
  line-height: 1;
  color: var(--vp-c-brand-1);
  font-variant-numeric: tabular-nums;
}

.api__figure span {
  margin-top: 0.35rem;
  font-size: 0.68rem;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.api__body {
  min-width: 0;
}

.api__lead {
  margin: 0.35rem 0 0.8rem;
  line-height: 1.6;
}

.api__regimes {
  display: grid;
  gap: 0.35rem 0.9rem;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  margin-bottom: 0.8rem;
}

.api__regime {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  min-width: 0;
  padding-left: 0.6rem;
  border-left: 3px solid var(--api-colour);
}

.api__regime code {
  font-size: 0.8rem;
  color: var(--api-colour);
  background: none;
  padding: 0;
}

.api__regime-count {
  font-size: 0.82rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.api__regime-note {
  flex: 1;
  min-width: 0;
  font-size: 0.76rem;
  color: var(--vp-c-text-3);
}

.api__meta {
  margin: 0;
  font-size: 0.78rem;
  color: var(--vp-c-text-3);
}

.api__meta code {
  font-size: 0.74rem;
}

.api__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  margin: 0 0 0.9rem;
  padding: 0;
  list-style: none;
}

.api__legend li {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-2);
}

.api__legend small {
  font-weight: 400;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}

.api__swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: var(--api-colour);
}

.api__groups {
  display: grid;
  gap: 0.7rem;
  grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
}

.api__group {
  padding: 0.8rem 0.9rem;
}

.api__group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.api__group h3 {
  margin: 0;
  font-family: "Libre Baskerville", Georgia, serif;
  font-size: 0.92rem;
  line-height: 1.3;
}

.api__count {
  font-family: "Libre Baskerville", Georgia, serif;
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1;
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}

.api__bar {
  display: flex;
  gap: 2px;
  height: 6px;
  margin-top: 0.7rem;
  border-radius: 999px;
  overflow: hidden;
}

.api__bar span {
  display: block;
  height: 100%;
}

.api__absent {
  margin: 1.5rem 0;
  font-size: 0.85rem;
  color: var(--vp-c-text-3);
}

@media (max-width: 620px) {
  .api__summary {
    flex-direction: column;
  }

  .api__figure {
    flex-direction: row;
    align-items: baseline;
    gap: 0.5rem;
    width: auto;
    border-right: none;
    border-bottom: 1px solid var(--vp-c-divider);
    padding: 0 0 0.8rem;
    justify-content: flex-start;
  }
}
</style>
