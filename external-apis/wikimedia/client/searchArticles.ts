import type { Domain } from "../../../dto/enums";
import {
    ArticleSearchHit,
    TopReadEntry,
    isContentArticleTitle,
    toDisplayTitle,
} from "../wikimedia";
import {
    MAX_CONCURRENT_REQUESTS,
    fetchJsonWithRetry,
    mapWithLimit,
    shiftUtcDays,
    withCache,
} from "./internal";
import type { CacheLike, WikimediaHttp } from "../client";
import type { ArticleViews } from "./articleViews";

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_SEARCH_CACHE_TTL = 7 * DAY;

type SearchPage = {
    key: string;
    title: string;
    description?: string;
};

type SearchResponse = {
    pages: SearchPage[];
};

function buildArticleUrl(domain: Domain, title: string): string {
    return `https://${domain}.wikipedia.org/wiki/${encodeURIComponent(title).replace(/%20/g, "_")}`;
}

/**
 * Searches for article titles without touching the pageviews API.
 *
 * This is the search call on its own: one request, no per-article fan-out.
 * `searchArticles` below is this plus a view series per hit, which is what the
 * market listing needs — but a caller that only wants to know *which articles
 * exist* (the Article Genie seeding its candidate set, ADR 0006) would pay one
 * 365-day pageview request per hit for data it discards. At the Genie's ~40
 * candidates that is ~40 wasted requests before it can ask its first question,
 * so the two are separated rather than one being layered over the other.
 *
 * Cached under its own key: the two searches return different shapes, and a
 * shared key would let whichever ran first decide what the other got back.
 */
export function createSearchTitles(
    http: WikimediaHttp,
    cache: CacheLike | null,
    retryCount: number,
) {
    return async function searchTitles(
        domain: Domain,
        query: string,
        limit: number,
    ): Promise<ArticleSearchHit[]> {
        const trimmed = query.trim();
        if (!trimmed) return [];

        const cacheKey = `wikimedia:searchtitles:${domain}.wikipedia:${encodeURIComponent(trimmed)}:limit:${limit}`;
        const cacheWithTtl = cache ? { ...cache, ttlMs: DEFAULT_SEARCH_CACHE_TTL } : null;

        return withCache(cacheWithTtl, cacheKey, async () => {
            const url = `https://api.wikimedia.org/core/v1/wikipedia/${domain}/search/page?q=${encodeURIComponent(trimmed)}&limit=${limit}`;

            const response = await fetchJsonWithRetry<SearchResponse>(http, url, retryCount);

            return (response.pages ?? [])
                .filter((page) => isContentArticleTitle(page.key))
                .map((page) => ({
                    canonicalTitle: page.key,
                    displayTitle: page.title || toDisplayTitle(page.key),
                    description: page.description,
                }));
        });
    };
}

export function createSearchArticles(
    http: WikimediaHttp,
    cache: CacheLike | null,
    retryCount: number,
    resolveArticleViews: (domain: Domain, title: string, snapshotDate: Date) => Promise<ArticleViews>,
    searchTitles = createSearchTitles(http, cache, retryCount),
) {
    return async function searchArticles(
        domain: Domain,
        query: string,
        limit: number,
    ): Promise<TopReadEntry[]> {
        const trimmed = query.trim();
        if (!trimmed) return [];

        const cacheKey = `wikimedia:search:${domain}.wikipedia:${encodeURIComponent(trimmed)}:limit:${limit}`;
        const cacheWithTtl = cache ? { ...cache, ttlMs: DEFAULT_SEARCH_CACHE_TTL } : null;

        return withCache(cacheWithTtl, cacheKey, async () => {
            const hits = await searchTitles(domain, trimmed, limit);
            const snapshotDate = shiftUtcDays(new Date(), -1);

            // One per-article request per hit — capped like every other
            // fan-out in this client.
            const entries = await mapWithLimit(
                hits.map((hit, idx) => ({ hit, idx })),
                MAX_CONCURRENT_REQUESTS,
                async ({ hit, idx }): Promise<TopReadEntry> => {
                    const views = await resolveArticleViews(domain, hit.canonicalTitle, snapshotDate);
                    return {
                        canonicalTitle: hit.canonicalTitle,
                        displayTitle: hit.displayTitle,
                        description: hit.description,
                        sourceRank: idx + 1,
                        filteredRank: idx + 1,
                        dailyViews: views.latestDayViews ?? 0,
                        articleUrl: buildArticleUrl(domain, hit.canonicalTitle),
                        averageViews30d: views.averageViews30d,
                        weekViews: views.weekViews,
                        monthViews: views.monthViews,
                        yearViews: views.yearViews,
                    };
                },
            );

            return entries;
        });
    };
}
