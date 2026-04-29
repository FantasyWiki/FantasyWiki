import type { Enums } from "../../../dto/enums";
import {
  computeFilteredSnapshotVolume,
  normalizeTopReadEntries,
  toWikimediaProjectDomain,
  type TopReadEntry,
  type WikimediaTopReadArticle,
} from "../../../model/wikimedia";

type FetchFn = typeof fetch;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

type TopReadListParams = {
  domain: Enums;
  limit: number;
};

type TopReadListResult = {
  projectDomain: string;
  snapshotDate: string;
  filteredSnapshotVolume: number;
  entries: TopReadEntry[];
};

type WikimediaClientOptions = {
  fetchFn?: FetchFn;
  now?: () => Date;
  storage?: StorageLike | null;
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

const BASE_URL = "https://wikimedia.org/api/rest_v1/metrics/pageviews";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toYmd(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
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

async function fetchJsonWithRetry<T>(
  fetchFn: FetchFn,
  url: string,
  retryCount: number
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const response = await fetchFn(url);
      if (!response.ok) {
        if (
          (response.status === 429 || response.status >= 500) &&
          attempt < retryCount
        ) {
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as T;
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
  fetchFn: FetchFn,
  projectDomain: string,
  title: string,
  snapshotDate: Date,
  averageDays: number,
  retryCount: number
): Promise<number | undefined> {
  const end = toDateParts(snapshotDate);
  const startDate = shiftUtcDays(snapshotDate, -(averageDays - 1));
  const start = toDateParts(startDate);
  const encodedTitle = encodeURIComponent(title).replace(/%20/g, "_");

  const url = `${BASE_URL}/per-article/${projectDomain}/all-access/user/${encodedTitle}/daily/${start.year}${start.month}${start.day}/${end.year}${end.month}${end.day}`;

  try {
    const response = await fetchJsonWithRetry<PerArticleResponse>(
      fetchFn,
      url,
      retryCount
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
  const now = options.now ?? (() => new Date());
  const storage =
    options.storage === undefined
      ? typeof window !== "undefined"
        ? window.localStorage
        : null
      : options.storage;
  const maxFallbackDays = options.maxFallbackDays ?? 2;
  const retryCount = options.retryCount ?? 2;
  const averageDays = options.averageDays ?? 30;

  async function getTopReadList(
    params: TopReadListParams
  ): Promise<TopReadListResult> {
    const projectDomain = toWikimediaProjectDomain(params.domain);
    const baseDate = now();

    for (let offset = 1; offset <= maxFallbackDays; offset += 1) {
      const snapshotDate = shiftUtcDays(baseDate, -offset);
      const snapshotDateText = toYmd(snapshotDate);
      const cacheKey = `wikimedia:top-read:${projectDomain}:${snapshotDateText}:limit:${params.limit}`;

      const cached = storage?.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached) as TopReadListResult;
      }

      const parts = toDateParts(snapshotDate);
      const url = `${BASE_URL}/top/${projectDomain}/all-access/${parts.year}/${parts.month}/${parts.day}`;

      try {
        const topRead = await fetchJsonWithRetry<TopReadResponse>(
          fetchFn,
          url,
          retryCount
        );
        const articles = topRead.items?.[0]?.articles ?? [];
        const filteredSnapshotVolume = computeFilteredSnapshotVolume(articles);
        const entries = normalizeTopReadEntries(
          articles,
          params.limit,
          projectDomain
        );

        const entriesWithAverage = await Promise.all(
          entries.map(async (entry) => ({
            ...entry,
            averageViews30d: await resolveAverageViews(
              fetchFn,
              projectDomain,
              entry.canonicalTitle,
              snapshotDate,
              averageDays,
              retryCount
            ),
          }))
        );

        const result: TopReadListResult = {
          projectDomain,
          snapshotDate: snapshotDateText,
          filteredSnapshotVolume,
          entries: entriesWithAverage,
        };

        storage?.setItem(cacheKey, JSON.stringify(result));
        return result;
      } catch {
        continue;
      }
    }

    throw new Error("Top read snapshot unavailable");
  }

  return {
    pageviews: {
      getTopReadList,
    },
  };
}
