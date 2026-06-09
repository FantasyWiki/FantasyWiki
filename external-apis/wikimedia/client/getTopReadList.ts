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

export function createGetTopReadList(http: WikimediaHttp,
cache: CacheLike | null,
maxFallbackDays: number,
retryCount: number,
averageDays: number,) {

    async function resolveAverageViews(
        domain: Domain,
        title: string,
        snapshotDate: Date,
    ): Promise<number | undefined> {
        const end = toDateParts(snapshotDate);
        const startDate = shiftUtcDays(snapshotDate, -(averageDays - 1));
        const start = toDateParts(startDate);
        const encodedTitle = encodeURIComponent(title).replace(/%20/g, "_");
        const url = `${PAGEVIEWS_BASE_URL}/per-article/${domain}.wikipedia/all-access/user/${encodedTitle}/daily/${start.year}${start.month}${start.day}/${end.year}${end.month}${end.day}`;

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
        const baseDate = new Date();

        for (let offset = 1; offset <= maxFallbackDays; offset += 1) {
            const snapshotDate = shiftUtcDays(baseDate, -offset);
            const snapshotDateText = toYmd(snapshotDate);
            const cacheKey = `wikimedia:top-read:${domain}.wikipedia:${snapshotDateText}:limit:${limit}`;

            const parts = toDateParts(snapshotDate);
            const url = `${PAGEVIEWS_BASE_URL}/top/${domain}.wikipedia/all-access/${parts.year}/${parts.month}/${parts.day}`;

            try {
                return await withCache(cache, cacheKey, async () => {
                    const topRead = await fetchJsonWithRetry<TopReadResponse>(http, url, retryCount);
                    const articles = topRead.items?.[0]?.articles ?? [];
                    const entries = normalizeTopReadEntries(articles, limit, domain);

                    const entriesWithAverage = await Promise.all(
                        entries.map(async (entry) => ({
                            ...entry,
                            averageViews30d: await resolveAverageViews(
                                domain,
                                entry.canonicalTitle,
                                snapshotDate,
                            ),
                        })),
                    );

                    return {
                        domain,
                        snapshotDate: snapshotDateText,
                        entries: entriesWithAverage,
                    };
                });
            } catch {
            }
        }

        throw new Error("Top read snapshot unavailable");
    };
}