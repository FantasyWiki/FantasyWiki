<template>
  <div class="summary-header">
    <img
      class="summary-thumbnail"
      :src="thumbnailUrl"
      :alt="`${model.article.title} thumbnail`"
    />
    <div class="summary-meta">
      <h2 class="summary-title ion-no-margin">{{ model.article.title }}</h2>
      <a
        class="summary-link"
        :href="wikipediaUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open on Wikipedia
      </a>
    </div>
  </div>

  <p class="summary-content summary-content--single ion-margin">
    <span>{{ summaryPreview }}</span>
    <button
      v-if="hasSummaryRemainder && !isExpanded"
      class="summary-inline-toggle"
      type="button"
      @click="isExpanded = true"
    >
      ...
    </button>
    <template v-if="isExpanded && hasSummaryRemainder">
      <span> {{ summaryRemainder }}</span>
      <button
        class="summary-inline-toggle summary-inline-toggle--less"
        type="button"
        @click="isExpanded = false"
      >
        less
      </button>
    </template>
  </p>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { ArticleDetail } from "@/types/articleDetail";

interface Props {
  model: ArticleDetail;
  summaryExtract?: string;
  summaryThumbnailUrl?: string;
  isLoadingSummary: boolean;
}

const props = defineProps<Props>();
const isExpanded = ref(false);

const thumbnailUrl = computed(() => {
  return props.summaryThumbnailUrl ?? "/article-placeholder.svg";
});

const summaryText = computed(() => {
  if (props.isLoadingSummary) return "Loading summary...";
  if (props.summaryExtract && props.summaryExtract.trim().length > 0) {
    return props.summaryExtract;
  }
  return "Summary unavailable.";
});

const summarySplit = computed(() => {
  const text = summaryText.value.trim();
  const maxPreviewChars = 140;
  const minPreviewChars = 70;
  if (text.length <= maxPreviewChars) {
    return { preview: text, remainder: "" };
  }

  const sentenceBoundary = text.search(/[.!?]\s+/);
  if (
    sentenceBoundary >= minPreviewChars &&
    sentenceBoundary <= maxPreviewChars
  ) {
    const splitIndex = sentenceBoundary + 1;
    return {
      preview: text.slice(0, splitIndex).trimEnd(),
      remainder: text.slice(splitIndex).trimStart(),
    };
  }

  const wordBoundary = text.lastIndexOf(" ", maxPreviewChars);
  const splitIndex =
    wordBoundary > minPreviewChars ? wordBoundary : maxPreviewChars;

  return {
    preview: text.slice(0, splitIndex).trimEnd(),
    remainder: text.slice(splitIndex).trimStart(),
  };
});

const summaryPreview = computed(() => summarySplit.value.preview);
const summaryRemainder = computed(() => summarySplit.value.remainder);

const hasSummaryRemainder = computed(() => summaryRemainder.value.length > 0);

const wikipediaUrl = computed(() => {
  const title = encodeURIComponent(props.model.article.title).replace(
    /%20/g,
    "_"
  );
  return `https://${props.model.article.domain}.wikipedia.org/wiki/${title}`;
});
</script>

<style scoped>
.summary-header {
  display: grid;
  grid-template-columns: 112px 1fr;
  gap: 0.9rem;
  align-items: center;
}

.summary-thumbnail {
  width: 112px;
  height: 112px;
  object-fit: cover;
  border-radius: 0.75rem;
  border: 1px solid var(--ion-border-color);
}

.summary-meta {
  min-width: 0;
}

.summary-title {
  color: var(--ion-color-dark);
  font-family: var(--font-family-headings), serif;
  font-size: 1.45rem;
  font-weight: 700;
  line-height: 1.18;
  margin-bottom: 0.45rem;
}

.summary-link {
  display: inline-block;
  color: var(--ion-color-primary);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.83rem;
  letter-spacing: 0.01em;
}

.summary-link:hover {
  text-decoration: underline;
}

.summary-content {
  color: inherit;
  font: inherit;
  color: var(--ion-color-medium-shade);
}

.summary-content--single {
  margin-top: 0.75rem;
  font-size: 0.88rem;
  font-family: var(--ion-font-family);
  line-height: 1.45;
}

.summary-inline-toggle {
  border: 0;
  background: transparent;
  padding: 0;
  margin-left: 0.2rem;
  color: var(--ion-color-medium);
  font: inherit;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.summary-inline-toggle--less {
  margin-left: 0.4rem;
  font-weight: 600;
  letter-spacing: 0;
}

@media (max-width: 576px) {
  .summary-header {
    grid-template-columns: 88px 1fr;
    gap: 0.62rem;
  }

  .summary-thumbnail {
    width: 88px;
    height: 88px;
    border-radius: 0.62rem;
  }

  .summary-title {
    font-size: 1.1rem;
    margin-bottom: 0.32rem;
  }

  .summary-link {
    font-size: 0.78rem;
  }

  .summary-content--single {
    font-size: 0.82rem;
  }
}
</style>
