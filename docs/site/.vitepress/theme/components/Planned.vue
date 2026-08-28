<script setup lang="ts">
/**
 * Marks a space that has been prepared and not yet filled.
 *
 * The site's whole claim is that what is written here is true, so the one thing
 * that must never happen is plausible prose standing in for work not yet done.
 * A section that is waiting for evidence says so, in a band nobody can mistake
 * for content, and names the evidence it is waiting for.
 *
 * Pages that are entirely unwritten also carry `status: planned` in their
 * frontmatter, which is what makes them findable without reading the page.
 */
defineProps<{ evidence?: string }>();
</script>

<template>
  <aside class="planned">
    <p class="planned__flag">Not written yet</p>
    <div class="planned__body"><slot /></div>
    <p v-if="evidence" class="planned__evidence">
      <strong>Will be written from:</strong> {{ evidence }}
    </p>
  </aside>
</template>

<style scoped>
.planned {
  margin: 1.4rem 0;
  padding: 0.9rem 1.1rem;
  border: 1px dashed var(--fw-type-adr);
  border-radius: var(--fw-radius-md);
  background: var(--vp-c-bg-alt);
}

.planned__flag {
  margin: 0 0 0.5rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fw-type-adr);
}

.planned__body {
  font-size: 0.92rem;
  line-height: 1.65;
  color: var(--vp-c-text-2);
}

.planned__body :deep(p) {
  margin: 0 0 0.6rem;
}

.planned__body :deep(p:last-child) {
  margin-bottom: 0;
}

.planned__body :deep(ul) {
  margin: 0.2rem 0 0.6rem;
  padding-left: 1.1rem;
}

.planned__evidence {
  margin: 0.7rem 0 0;
  padding-top: 0.6rem;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
}
</style>
