import type { Domain } from "../../../dto/enums";
import { TopReadEntry, isContentArticleTitle, toDisplayTitle } from "../wikimedia";
import { fetchJsonWithRetry, shiftUtcDays, withCache } from "./internal";
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

export function createSearchArticles(
    http: WikimediaHttp,
    cache: CacheLike | null,
    retryCount: number,
    resolveArticleViews: (domain: Domain, title: string, snapshotDate: Date) => Promise<ArticleViews>,
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
            const url = `https://api.wikimedia.org/core/v1/wikipedia/${domain}/search/page?q=${encodeURIComponent(trimmed)}&limit=${limit}`;

            const response = await fetchJsonWithRetry<SearchResponse>(http, url, retryCount);
            const pages = (response.pages ?? []).filter((p) => isContentArticleTitle(p.key));

            const snapshotDate = shiftUtcDays(new Date(), -1);

            const entries = await Promise.all(
                pages.map(async (page, idx): Promise<TopReadEntry> => {
                    const views = await resolveArticleViews(domain, page.key, snapshotDate);
                    return {
                        canonicalTitle: page.key,
                        displayTitle: page.title || toDisplayTitle(page.key),
                        sourceRank: idx + 1,
                        filteredRank: idx + 1,
                        dailyViews: views.latestDayViews ?? 0,
                        articleUrl: buildArticleUrl(domain, page.key),
                        averageViews30d: views.averageViews30d,
                        weekViews: views.weekViews,
                        monthViews: views.monthViews,
                        yearViews: views.yearViews,
                    };
                }),
            );

            return entries;
        });
    };
}
