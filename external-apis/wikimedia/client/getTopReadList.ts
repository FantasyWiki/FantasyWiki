import type { Domain } from "../../../model/enums";
import {
  normalizeTopReadEntries,
  TopReadEntry,
  WikimediaTopReadArticle,
} from "../wikimedia";
import {
  PAGEVIEWS_BASE_URL,
  fetchJsonWithRetry,
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

          const entriesWithViews = await Promise.all(
            entries.map(async (entry) => {
              const views = await resolveArticleViews(
                domain,
                entry.canonicalTitle,
                snapshotDate,
              );
              return { ...entry, ...views };
            }),
          );

          return {
            domain,
            snapshotDate: snapshotDateText,
            entries: entriesWithViews,
          };
        });
      } catch {}
    }

    throw new Error("Top read snapshot unavailable");
  };
}
