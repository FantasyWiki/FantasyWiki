import type { Domain } from "../../../dto/enums";
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

export type PerArticleResponse = {
  items: Array<{ views: number }>;
};

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

const HISTORY_DAYS = 365;

type ArticleViews = {
  averageViews30d: number | undefined;
  weekViews: number | undefined;
  monthViews: number | undefined;
  yearViews: number | undefined;
};

export function createGetTopReadList(
  http: WikimediaHttp,
  cache: CacheLike | null,
  maxFallbackDays: number,
  retryCount: number,
  averageDays: number,
) {
  async function resolveArticleViews(
    domain: Domain,
    title: string,
    snapshotDate: Date,
  ): Promise<ArticleViews> {
    const end = toDateParts(snapshotDate);
    const startDate = shiftUtcDays(snapshotDate, -(HISTORY_DAYS - 1));
    const start = toDateParts(startDate);
    const encodedTitle = encodeURIComponent(title).replace(/%20/g, "_");
    const url = `${PAGEVIEWS_BASE_URL}/per-article/${domain}.wikipedia/all-access/user/${encodedTitle}/daily/${start.year}${start.month}${start.day}/${end.year}${end.month}${end.day}`;

    try {
      const response = await fetchJsonWithRetry<PerArticleResponse>(
        http,
        url,
        retryCount,
      );
      const items = response.items;
      if (items.length === 0) {
        return {
          averageViews30d: undefined,
          weekViews: undefined,
          monthViews: undefined,
          yearViews: undefined,
        };
      }

      const sum = (slice: Array<{ views: number }>) =>
        slice.reduce((acc, item) => acc + item.views, 0);

      const trailing7 = items.slice(-7);
      const trailing30 = items.slice(-30);
      const trailingAvg = items.slice(-averageDays);

      return {
        averageViews30d: sum(trailingAvg) / trailingAvg.length,
        weekViews: sum(trailing7),
        monthViews: sum(trailing30),
        yearViews: sum(items),
      };
    } catch {
      return {
        averageViews30d: undefined,
        weekViews: undefined,
        monthViews: undefined,
        yearViews: undefined,
      };
    }
  }

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
