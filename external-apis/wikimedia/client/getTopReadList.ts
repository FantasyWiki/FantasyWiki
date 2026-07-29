import type { Domain } from "../../../model/enums";
import {
  normalizeTopReadEntries,
  TopReadEntry,
  WikimediaTopReadArticle,
} from "../wikimedia";
import {
  MAX_CONCURRENT_REQUESTS,
  PAGEVIEWS_BASE_URL,
  fetchJsonWithRetry,
  mapWithLimit,
  shiftUtcDays,
  toDateParts,
  toYmd,
  withCache,
} from "./internal";
import { CacheLike, WikimediaHttp } from "../client";
import { createResolveArticleViews } from "./articleViews";

export type TopReadResponse = {
  items: Array<{
    articles: WikimediaTopReadArticle[];
  }>;
};

export type TopReadListResult = {
  domain: Domain;
  snapshotDate: string;
  entries: TopReadEntry[];
};

export function createGetTopReadList(
  http: WikimediaHttp,
  cache: CacheLike | null,
  maxFallbackDays: number,
  retryCount: number,
  averageDays: number,
  resolveArticleViews = createResolveArticleViews(http, retryCount, averageDays),
) {
  return async function getTopReadList(
    domain: Domain,
    limit: number,
    onPartial?: (partial: TopReadListResult) => void,
  ): Promise<TopReadListResult> {
    const baseDate = new Date();

    for (let offset = 1; offset <= maxFallbackDays; offset += 1) {
      const snapshotDate = shiftUtcDays(baseDate, -offset);
      const snapshotDateText = toYmd(snapshotDate);
      const cacheKey = `wikimedia:top-read:${domain}.wikipedia:${snapshotDateText}:limit:${limit}`;

      const parts = toDateParts(snapshotDate);
      const url = `${PAGEVIEWS_BASE_URL}/top/${domain}.wikipedia/all-access/${parts.year}/${parts.month}/${parts.day}`;

      try {
        return await withCache(cache, cacheKey, async () => {
          const topRead = await fetchJsonWithRetry<TopReadResponse>(
            http,
            url,
            retryCount,
          );
          const articles = topRead.items?.[0]?.articles ?? [];
          const entries = normalizeTopReadEntries(articles, limit, domain);

          // The /top payload alone already carries each entry's title, rank and
          // the snapshot day's views, so a caller that passed `onPartial` can
          // render the whole list after this one request instead of waiting on
          // the fan-out below. Entries not yet hydrated carry no
          // averageViews30d/week/month/year — that absence is how a consumer
          // tells a pending row from a resolved one.
          const hydrated = entries.slice();
          const emit = onPartial
            ? () =>
                onPartial({
                  domain,
                  snapshotDate: snapshotDateText,
                  entries: hydrated.slice(),
                })
            : undefined;
          emit?.();

          // One per-article request per entry: capped rather than fanned out
          // all at once, since a top-read list is 50 entries.
          await mapWithLimit(
            entries.map((entry, index) => ({ entry, index })),
            MAX_CONCURRENT_REQUESTS,
            async ({ entry, index }) => {
              const views = await resolveArticleViews(
                domain,
                entry.canonicalTitle,
                snapshotDate,
              );
              hydrated[index] = { ...entry, ...views };
              emit?.();
            },
          );

          // Only the fully hydrated list is returned — and so only it reaches
          // the cache, never one of the partials emitted above.
          return {
            domain,
            snapshotDate: snapshotDateText,
            entries: hydrated,
          };
        });
      } catch {}
    }

    throw new Error("Top read snapshot unavailable");
  };
}
