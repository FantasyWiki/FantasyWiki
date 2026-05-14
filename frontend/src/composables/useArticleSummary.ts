import { ref, watch, type Ref } from "vue";
import type { Domain } from "../../../dto/enums";
import { createWikimediaClient } from "@/services/wikimediaClient";
import type { ArticleSummary } from "../../../external-apis/wikimedia/client/getSummary";

type ArticleSummarySource = {
  title: string;
  domain: Domain;
} | null;

const summaryCache = new Map<string, ArticleSummary>();
const wikimediaClient = createWikimediaClient();

export function useArticleSummary(source: Ref<ArticleSummarySource>) {
  const summary = ref<ArticleSummary | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  watch(
    source,
    async (nextSource, _previousSource, onInvalidate) => {
      let cancelled = false;
      onInvalidate(() => {
        cancelled = true;
      });

      if (!nextSource) {
        summary.value = null;
        error.value = null;
        isLoading.value = false;
        return;
      }

      const cacheKey = `${nextSource.domain}:${nextSource.title}`;
      const cached = summaryCache.get(cacheKey);
      if (cached) {
        summary.value = cached;
        error.value = null;
        isLoading.value = false;
        return;
      }

      isLoading.value = true;
      error.value = null;
      try {
        const nextSummary = await wikimediaClient.article.getSummary(
          nextSource.domain,
          nextSource.title
        );
        if (cancelled) return;
        summaryCache.set(cacheKey, nextSummary);
        summary.value = nextSummary;
      } catch (err) {
        if (cancelled) return;
        summary.value = null;
        error.value =
          err instanceof Error ? err.message : "Summary unavailable";
      } finally {
        if (!cancelled) {
          isLoading.value = false;
        }
      }
    },
    { immediate: true }
  );

  return {
    summary,
    isLoading,
    error,
  };
}
