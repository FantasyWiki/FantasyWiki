import type { Enums } from "../../dto/enums";
import {
  computeFilteredSnapshotVolume,
  normalizeTopReadEntries,
  toWikimediaProjectDomain,
  type TopReadEntry,
  type WikimediaTopReadArticle,
} from "../../model/wikimedia";

type FetchFn = typeof fetch;

export type CacheLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type WikimediaHttp = {
  get<T>(url: string): Promise<{ status: number; data: T }>;
};

export type TopReadListResult = {
  projectDomain: string;
  snapshotDate: string;
  filteredSnapshotVolume: number;
  entries: TopReadEntry[];
};

export type ArticleSummary = {
  title: string;
  extract: string;
  thumbnailUrl?: string;
};

export type WikimediaClientOptions = {
  http?: WikimediaHttp;
  fetchFn?: FetchFn;
  now?: () => Date;
  cache?: CacheLike | null;
  maxFallbackDays?: number;
  retryCount?: number;
  averageDays?: number;
};

type TopReadResponse = {
  items: Array<{
    articles: WikimediaTopReadArticle[];
  }>;
};

type PerArticleResponse = {
  items: Array<{ views: number }>;
};

type ArticleSummaryResponse = {
  title?: string;
  extract?: string;
  thumbnail?: {
    source?: string;
  };
};

const BASE_URL = "https://wikimedia.org/api/rest_v1/metrics/pageviews";
const BASE_WIKIPEDIA_URL = "https://wikipedia.org/api/rest_v1";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toYmd(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`;
}

function shiftUtcDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
}

function toDateParts(date: Date): { year: string; month: string; day: string } {
  return {
    year: String(date.getUTCFullYear()),
    month: pad(date.getUTCMonth() + 1),
    day: pad(date.getUTCDate()),
  };
}

function getDefaultCache(): CacheLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createFetchHttp(fetchFn: FetchFn): WikimediaHttp {
  return {
    async get<T>(url: string): Promise<{ status: number; data: T }> {
      const response = await fetchFn(url);
      const data = (await response.json()) as T;
      return { status: response.status, data };
    },
  };
}

async function fetchJsonWithRetry<T>(
  http: WikimediaHttp,
  url: string,
  retryCount: number,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const response = await http.get<T>(url);
      if (response.status >= 200 && response.status < 300) {
        return response.data;
      }

      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < retryCount
      ) {
        continue;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Network request failed");
      if (
        lastError.message.startsWith("HTTP 4") &&
        !lastError.message.startsWith("HTTP 429")
      ) {
        throw lastError;
      }

      if (attempt >= retryCount) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Network request failed");
}

async function resolveAverageViews(
  http: WikimediaHttp,
  projectDomain: string,
  title: string,
  snapshotDate: Date,
  averageDays: number,
  retryCount: number,
): Promise<number | undefined> {
  const end = toDateParts(snapshotDate);
  const startDate = shiftUtcDays(snapshotDate, -(averageDays - 1));
  const start = toDateParts(startDate);
  const encodedTitle = encodeURIComponent(title).replace(/%20/g, "_");

  const url = `${BASE_URL}/per-article/${projectDomain}/all-access/user/${encodedTitle}/daily/${start.year}${start.month}${start.day}/${end.year}${end.month}${end.day}`;

  try {
    const response = await fetchJsonWithRetry<PerArticleResponse>(
      http,
      url,
      retryCount,
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

export function createWikimediaClient(options: WikimediaClientOptions = {}) {
  const fetchFn = options.fetchFn ?? fetch;
  const http = options.http ?? createFetchHttp(fetchFn);
  const now = options.now ?? (() => new Date());
  const cache = options.cache === undefined ? getDefaultCache() : options.cache;
  const maxFallbackDays = options.maxFallbackDays ?? 2;
  const retryCount = options.retryCount ?? 2;
  const averageDays = options.averageDays ?? 30;

  async function getTopReadList(
    domain: Enums,
    limit: number,
  ): Promise<TopReadListResult> {
    const projectDomain = toWikimediaProjectDomain(domain);
    const baseDate = now();

    for (let offset = 1; offset <= maxFallbackDays; offset += 1) {
      const snapshotDate = shiftUtcDays(baseDate, -offset);
      const snapshotDateText = toYmd(snapshotDate);
      const cacheKey = `wikimedia:top-read:${projectDomain}:${snapshotDateText}:limit:${limit}`;

      let cached: string | null = null;
      try {
        cached = cache?.getItem(cacheKey) ?? null;
      } catch {
        cached = null;
      }

      if (cached) {
        try {
          return JSON.parse(cached) as TopReadListResult;
        } catch {
          try {
            cache?.removeItem(cacheKey);
          } catch {
            // Ignore cache remove failures: cache is best-effort.
          }
        }
      }

      const parts = toDateParts(snapshotDate);
      const url = `${BASE_URL}/top/${projectDomain}/all-access/${parts.year}/${parts.month}/${parts.day}`;

      try {
        const topRead = await fetchJsonWithRetry<TopReadResponse>(
          http,
          url,
          retryCount,
        );
        const articles = topRead.items?.[0]?.articles ?? [];
        const filteredSnapshotVolume = computeFilteredSnapshotVolume(articles);
        const entries = normalizeTopReadEntries(articles, limit, projectDomain);

        const entriesWithAverage = await Promise.all(
          entries.map(async (entry) => ({
            ...entry,
            averageViews30d: await resolveAverageViews(
              http,
              projectDomain,
              entry.canonicalTitle,
              snapshotDate,
              averageDays,
              retryCount,
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
          cache?.setItem(cacheKey, JSON.stringify(result));
        } catch {
          // Ignore cache write failures: cache is best-effort.
        }
        return result;
      } catch {
          // Fall back to the previous day's snapshot when this date is unavailable.
      }
    }

    throw new Error("Top read snapshot unavailable");
  }

  async function getSummary(
    domain: Enums,
    title: string,
  ): Promise<ArticleSummary> {
    const projectDomain = toWikimediaProjectDomain(domain);
    const encodedTitle = encodeURIComponent(title).replace(/%20/g, "_");
    const url = `${BASE_WIKIPEDIA_URL}/page/summary/${encodedTitle}`;

    const response = await fetchJsonWithRetry<ArticleSummaryResponse>(
      {
        get: async <ArticleSummaryResponse>(targetUrl: string) => {
          const rewrittenUrl = targetUrl.replace(
            BASE_WIKIPEDIA_URL,
            `https://${projectDomain}.org/api/rest_v1`,
          );
          return http.get<ArticleSummaryResponse>(rewrittenUrl);
        },
      },
      url,
      retryCount,
    );

    return {
      title: response.title ?? title,
      extract: response.extract ?? "",
      thumbnailUrl: response.thumbnail?.source,
    };
  }

  return {
    pageviews: {
      getTopReadList,
    },
    article: {
      getSummary,
    },
  };
}
