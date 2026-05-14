import type { Domain } from "../../../dto/enums";
import {
    computeFilteredSnapshotVolume,
    normalizeTopReadEntries, TopReadEntry, WikimediaTopReadArticle,
} from "../wikimedia";
import {
    PAGEVIEWS_BASE_URL,
    fetchJsonWithRetry,
    shiftUtcDays,
    toDateParts,
    toYmd,
} from "./internal";
import {CacheLike, WikimediaHttp} from "../client";

/**
 * Raw payload returned by Wikimedia per-article pageviews endpoint.
 */
export type PerArticleResponse = {
    items: Array<{ views: number }>;
};


/**
 * Raw payload returned by Wikimedia top-read endpoint.
 *
 * This type is intentionally internal: it models upstream response shape
 * before normalization into domain-friendly DTOs.
 */
export type TopReadResponse = {
    items: Array<{
        articles: WikimediaTopReadArticle[];
    }>;
};

/**
 * Normalized result returned by `pageviews.getTopReadList`.
 */
export type TopReadListResult = {
    projectDomain: string;
    snapshotDate: string;
    filteredSnapshotVolume: number;
    entries: TopReadEntry[];
};

export type GetTopReadListDeps = {
    http: WikimediaHttp;
    cache: CacheLike | null;
    maxFallbackDays: number;
    retryCount: number;
    averageDays: number;
};

export function createGetTopReadList(deps: GetTopReadListDeps) {
    const { http, cache, maxFallbackDays, retryCount, averageDays } = deps;

    async function resolveAverageViews(
        projectDomain: string,
        title: string,
        snapshotDate: Date,
    ): Promise<number | undefined> {
        const end = toDateParts(snapshotDate);
        const startDate = shiftUtcDays(snapshotDate, -(averageDays - 1));
        const start = toDateParts(startDate);
        const encodedTitle = encodeURIComponent(title).replace(/%20/g, "_");
        const url = `${PAGEVIEWS_BASE_URL}/per-article/${projectDomain}/all-access/user/${encodedTitle}/daily/${start.year}${start.month}${start.day}/${end.year}${end.month}${end.day}`;

        try {
            const response = await fetchJsonWithRetry<PerArticleResponse>(http, url, retryCount);
            if (response.items.length === 0) return undefined;
            const total = response.items.reduce((sum, item) => sum + item.views, 0);
            return total / response.items.length;
        } catch {
            return undefined;
        }
    }

    return async function getTopReadList(domain: Domain, limit: number): Promise<TopReadListResult> {
        const projectDomain = `${domain}.wikipedia`;
        const baseDate = new Date();

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
                    try { cache?.removeItem(cacheKey); } catch { /* best-effort */ }
                }
            }

            const parts = toDateParts(snapshotDate);
            const url = `${PAGEVIEWS_BASE_URL}/top/${projectDomain}/all-access/${parts.year}/${parts.month}/${parts.day}`;

            try {
                const topRead = await fetchJsonWithRetry<TopReadResponse>(http, url, retryCount);
                const articles = topRead.items?.[0]?.articles ?? [];
                const filteredSnapshotVolume = computeFilteredSnapshotVolume(articles);
                const entries = normalizeTopReadEntries(articles, limit, projectDomain);

                const entriesWithAverage = await Promise.all(
                    entries.map(async (entry) => ({
                        ...entry,
                        averageViews30d: await resolveAverageViews(projectDomain, entry.canonicalTitle, snapshotDate),
                    })),
                );

                const result: TopReadListResult = {
                    projectDomain,
                    snapshotDate: snapshotDateText,
                    filteredSnapshotVolume,
                    entries: entriesWithAverage,
                };

                try { cache?.setItem(cacheKey, JSON.stringify(result)); } catch { /* best-effort */ }
                return result;
            } catch {
                // Fall back to the previous day's snapshot when this date is unavailable.
            }
        }

        throw new Error("Top read snapshot unavailable");
    };
}