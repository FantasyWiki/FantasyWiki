<script setup lang="ts">
import { computed, ref } from "vue";
import { withBase } from "vitepress";
import glossary from "@generated/glossary.json";

/**
 * The canonical vocabulary, rendered from `CONTEXT.md` at build time.
 *
 * Nothing here is retyped: the terms, their definitions and their avoid lists
 * are parsed out of the file that defines them, so a word added to the domain
 * appears here on the next publish. The bold inside a definition is not
 * decoration — it marks another canonical term, and the parser has already
 * turned it into a link to that term.
 */

interface Term {
  id: string;
  term: string;
  definition: string;
  definitionCore: string;
  plain: string;
  allowed: string[];
  avoid: string[];
  core: boolean;
}

interface Glossary {
  present: boolean;
  source?: string;
  terms?: Term[];
  withAvoid?: number;
  core?: number;
}

/**
 * `core` cuts the list to the terms marked `_Core_.` in `CONTEXT.md`. The exam
 * report renders the vocabulary that way: it is read straight through, once, so
 * it carries the words the rest of the document is written in and sends the
 * reader here for the other half. The page itself always carries all of them.
 */
const props = defineProps<{ core?: boolean }>();

const data = glossary as Glossary;

const all = computed(() => data.terms ?? []);
const terms = computed(() =>
  props.core ? all.value.filter((term) => term.core) : all.value,
);
const query = ref("");

const definitionOf = (term: Term) =>
  props.core ? term.definitionCore : term.definition;

/**
 * Filtering keeps the document's own order rather than re-ranking by match:
 * the vocabulary is written in the order the game uses it, from what Wikimedia
 * publishes through to what a league is, and that order is worth more than a
 * relevance score over the vocabulary.
 */
const shown = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return terms.value;
  return terms.value.filter((term) => term.plain.includes(needle));
});
</script>

<template>
  <div v-if="data.present" class="gloss">
    <div class="gloss__bar">
      <p v-if="core" class="gloss__count">
        The <strong>{{ terms.length }}</strong> terms the rest of this document is written in. The
        whole vocabulary, <strong>{{ all.length }}</strong> terms, is on
        <a :href="withBase('/overview/glossary.html')">the vocabulary page</a>.
      </p>
      <p v-else class="gloss__count">
        <strong>{{ terms.length }}</strong> terms · <strong>{{ data.withAvoid }}</strong> carry a
        list of the words they replace · <strong>{{ data.core }}</strong> are marked core, the
        vocabulary the report is written in
      </p>
      <input
        v-if="!core"
        v-model="query"
        class="gloss__filter"
        type="search"
        placeholder="Filter the vocabulary"
        aria-label="Filter the vocabulary"
      />
    </div>

    <dl class="gloss__list">
      <template v-for="term in shown" :key="term.id">
        <dt :id="term.id" class="gloss__term">
          <a :href="`#${term.id}`">{{ term.term }}</a>
          <span v-if="!core && term.core" class="gloss__core">core</span>
        </dt>
        <dd class="gloss__entry">
          <p class="gloss__definition" v-html="definitionOf(term)" />

          <p v-if="term.allowed.length" class="gloss__values">
            <span class="gloss__label">One of</span>
            <span v-for="value in term.allowed" :key="value" class="gloss__value">{{ value }}</span>
          </p>

          <p v-if="term.avoid.length" class="gloss__avoids">
            <span class="gloss__label gloss__label--avoid">Never</span>
            <span v-for="word in term.avoid" :key="word" class="gloss__avoid">{{ word }}</span>
          </p>
        </dd>
      </template>
    </dl>

    <p v-if="!shown.length" class="gloss__empty">
      No term matches “{{ query }}”. If the concept is real and the word is not here, it does not
      have a name yet.
    </p>
  </div>

  <p v-else class="gloss__empty">
    The glossary was not found in this build, so the vocabulary cannot be shown.
  </p>
</template>

<style scoped>
.gloss {
  margin: 1.5rem 0;
}

.gloss__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem 1rem;
  padding-bottom: 0.7rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.gloss__count {
  margin: 0;
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
}

.gloss__count strong {
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}

.gloss__filter {
  flex: 0 1 15rem;
  padding: 0.35rem 0.6rem;
  font-size: 0.85rem;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--fw-radius-sm);
}

.gloss__filter:focus {
  outline: none;
  border-color: var(--vp-c-brand-1);
}

/*
 * Two columns, so the canonical word is not a bold run-in at the head of a
 * paragraph but a heading in its own right — which is the whole claim the
 * glossary makes about it.
 */
.gloss__list {
  display: grid;
  grid-template-columns: minmax(0, 13rem) minmax(0, 1fr);
  margin: 0;
}

.gloss__term {
  grid-column: 1;
  padding: 1.1rem 1.2rem 1.1rem 0;
  border-top: 1px solid var(--vp-c-divider);
}

.gloss__term a {
  font-family: "Libre Baskerville", Georgia, serif;
  font-size: 0.98rem;
  line-height: 1.35;
  font-weight: 700;
  color: var(--vp-c-text-1);
  text-decoration: none;
}

.gloss__term a:hover {
  color: var(--vp-c-brand-1);
}

/* Only on the page that shows everything: in the report every term is core. */
.gloss__core {
  display: block;
  margin-top: 0.3rem;
  font-size: 0.63rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fw-type-domain);
}

.gloss__entry {
  grid-column: 2;
  margin: 0;
  padding: 1.1rem 0;
  border-top: 1px solid var(--vp-c-divider);
}

.gloss__definition {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.65;
  color: var(--vp-c-text-2);
}

/* A bold word in a definition is another canonical term, and says so. */
.gloss__definition :deep(.gloss__ref) {
  font-weight: 600;
  color: var(--vp-c-text-1);
  text-decoration: none;
  border-bottom: 1px solid var(--vp-c-divider);
}

.gloss__definition :deep(.gloss__ref:hover) {
  color: var(--vp-c-brand-1);
  border-bottom-color: var(--vp-c-brand-1);
}

.gloss__definition :deep(code) {
  font-size: 0.82em;
}

.gloss__values,
.gloss__avoids {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem 0.45rem;
  margin: 0.55rem 0 0;
}

.gloss__label {
  font-size: 0.63rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fw-type-domain);
}

.gloss__label--avoid {
  color: var(--fw-type-deployment);
}

.gloss__value,
.gloss__avoid {
  font-size: 0.76rem;
  line-height: 1.5;
  padding: 0.05rem 0.42rem;
  border-radius: var(--fw-radius-sm);
}

.gloss__value {
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
}

/*
 * Struck through *and* labelled. Either alone is ambiguous — a struck word with
 * no label reads as a deletion someone forgot to remove, and a label with no
 * mark makes the list scan like a second set of synonyms to use.
 */
.gloss__avoid {
  color: var(--vp-c-text-3);
  background: var(--vp-c-bg-alt);
  border: 1px solid transparent;
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}

.gloss__empty {
  margin: 1.2rem 0;
  font-size: 0.88rem;
  color: var(--vp-c-text-3);
}

@media (max-width: 760px) {
  .gloss__list {
    grid-template-columns: minmax(0, 1fr);
  }

  .gloss__term {
    grid-column: 1;
    padding: 1rem 0 0;
  }

  .gloss__entry {
    grid-column: 1;
    padding: 0.35rem 0 1rem;
    border-top: none;
  }
}
</style>
