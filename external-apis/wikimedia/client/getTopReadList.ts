import type { Domain } from "../../../dto/enums";
import {
  computeFilteredSnapshotVolume,
  normalizeTopReadEntries,
  toWikimediaProjectDomain,
} from "../../../model/wikimedia";
import type {
  CacheLike,
  TopReadListResult,
  WikimediaHttp,
} from "./public-api";
import type { PerArticleResponse, TopReadResponse } from "./wikimedia-wire";

type DateParts = { year: string; month: string; day: string };

type GetTopReadListDependencies = {
  http: WikimediaHttp;
  now: () => Date;
  cache: CacheLike | null;
  maxFallbackDays: number;
  retryCount: number;
  averageDays: number;
  baseUrl: string;
  toYmd: (date: Date) => string;
  shiftUtcDays: (date: Date, days: number) => Date;
  toDateParts: (date: Date) => DateParts;
  fetchJsonWithRetry: <T>(
    http: WikimediaHttp,
    url: string,
    retryCount: number,
  ) => Promise<T>;
};

async function resolveAverageViews(
  deps: GetTopReadListDependencies,
  projectDomain: string,
  title: string,
  snapshotDate: Date,
): Promise<number | undefined> {
  const end = deps.toDateParts(snapshotDate);
  const startDate = deps.shiftUtcDays(snapshotDate, -(deps.averageDays - 1));
  const start = deps.toDateParts(startDate);
  const encodedTitle = encodeURIComponent(title).replace(/%20/g, "_");
  const url = `${deps.baseUrl}/per-article/${projectDomain}/all-access/user/${encodedTitle}/daily/${start.year}${start.month}${start.day}/${end.year}${end.month}${end.day}`;

  try {
    const response = await deps.fetchJsonWithRetry<PerArticleResponse>(
      deps.http,
      url,
      deps.retryCount,
    );
    if (response.items.length === 0) {
      return undefined;
    }

    const total = response.items.reduce((sum, item) => sum + item.views, 0);
    return total / response.items.length;
  } catch {
    return undefined;
  }
}

export function createGetTopReadList(deps: GetTopReadListDependencies) {
  return async function getTopReadList(
    domain: Domain,
    limit: number,
  ): Promise<TopReadListResult> {
    const projectDomain = toWikimediaProjectDomain(domain);
    const baseDate = deps.now();

    for (let offset = 1; offset <= deps.maxFallbackDays; offset += 1) {
      const snapshotDate = deps.shiftUtcDays(baseDate, -offset);
      const snapshotDateText = deps.toYmd(snapshotDate);
      const cacheKey = `wikimedia:top-read:${projectDomain}:${snapshotDateText}:limit:${limit}`;

      let cached: string | null = null;
      try {
        cached = deps.cache?.getItem(cacheKey) ?? null;
      } catch {
        cached = null;
      }

      if (cached) {
        try {
          return JSON.parse(cached) as TopReadListResult;
        } catch {
          try {
            deps.cache?.removeItem(cacheKey);
          } catch {
            // Ignore cache remove failures: cache is best-effort.
          }
        }
      }

      const parts = deps.toDateParts(snapshotDate);
      const url = `${deps.baseUrl}/top/${projectDomain}/all-access/${parts.year}/${parts.month}/${parts.day}`;

      try {
        const topRead = await deps.fetchJsonWithRetry<TopReadResponse>(
          deps.http,
          url,
          deps.retryCount,
        );
        const articles = topRead.items?.[0]?.articles ?? [];
        const filteredSnapshotVolume = computeFilteredSnapshotVolume(articles);
        const entries = normalizeTopReadEntries(articles, limit, projectDomain);

        const entriesWithAverage = await Promise.all(
          entries.map(async (entry) => ({
            ...entry,
            averageViews30d: await resolveAverageViews(
              deps,
              projectDomain,
              entry.canonicalTitle,
              snapshotDate,
            ),
          })),
        );

        const result: TopReadListResult = {
          projectDomain,
          snapshotDate: snapshotDateText,
          filteredSnapshotVolume,
          entries: entriesWithAverage,
        };

        try {
          deps.cache?.setItem(cacheKey, JSON.stringify(result));
        } catch {
          // Ignore cache write failures: cache is best-effort.
        }
        return result;
      } catch {
        // Fall back to the previous day's snapshot when this date is unavailable.
      }
    }

    throw new Error("Top read snapshot unavailable");
  };
}
