import { ref, watch, type Ref } from "vue";
import type { Domain } from "../../../model/enums";
import { createWikimediaClient } from "@/services/wikimediaClient";
import type { ArticleViews } from "../../../external-apis/wikimedia/client/articleViews";

type ArticleViewsSource = {
  title: string;
  domain: Domain;
} | null;

const viewsCache = new Map<string, ArticleViews>();
const wikimediaClient = createWikimediaClient();

/**
 * Fetches live pageview/trend data for whichever article is being viewed —
 * independent of ownership, so the stats box shows the same view/trend
 * numbers whether the article was opened from the Team Dashboard or the
 * Market (neither ContractDTO nor ArticleDTO carry pageview data).
 */
export function useArticleViews(source: Ref<ArticleViewsSource>) {
  const views = ref<ArticleViews | null>(null);
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
        views.value = null;
        error.value = null;
        isLoading.value = false;
        return;
      }

      const cacheKey = `${nextSource.domain}:${nextSource.title}`;
      const cached = viewsCache.get(cacheKey);
      if (cached) {
        views.value = cached;
        error.value = null;
        isLoading.value = false;
        return;
      }

      isLoading.value = true;
      error.value = null;
      try {
        const nextViews = await wikimediaClient.pageviews.getArticleViews(
          nextSource.domain,
          nextSource.title
        );
        if (cancelled) return;
        viewsCache.set(cacheKey, nextViews);
        views.value = nextViews;
      } catch (err) {
        if (cancelled) return;
        views.value = null;
        error.value = err instanceof Error ? err.message : "Views unavailable";
      } finally {
        if (!cancelled) {
          isLoading.value = false;
        }
      }
    },
    { immediate: true }
  );

  return {
    views,
    isLoading,
    error,
  };
}
