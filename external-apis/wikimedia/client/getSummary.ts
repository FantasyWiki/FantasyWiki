import type { Domain } from "../../../dto/enums";
import {fetchJsonWithRetry, withCache} from "./internal";
import { wikipediaRestUrl} from "./internal";
import {CacheLike, WikimediaHttp} from "../client";

/**
 * Raw payload returned by Wikimedia page summary endpoint.
 */
export type ArticleSummaryResponse = {
    title?: string;
    extract?: string;
    thumbnail?: {
        source?: string;
    };
};

/**
 * Normalized article summary returned by `article.getSummary`.
 */
export type ArticleSummary = {
    title: string;
    extract: string;
    thumbnailUrl?: string;
};

export function createGetSummary(http: WikimediaHttp,
cache: CacheLike | null,
retryCount: number) {
    return async function getSummary(domain: Domain, title: string): Promise<ArticleSummary> {
        const encodedTitle = encodeURIComponent(title).replace(/%20/g, "_");
        const url = wikipediaRestUrl(domain,`/page/summary/${encodedTitle}`);
        const cacheKey = `wikimedia:summary:${domain}.wikipedia:${encodedTitle}`;

        return withCache(cache, cacheKey, async () => {
            const response = await fetchJsonWithRetry<ArticleSummaryResponse>(
                http,
                url,
                retryCount,
            );

            return {
                title: response.title ?? title,
                extract: response.extract ?? "",
                thumbnailUrl: response.thumbnail?.source,
            };
        })


    };
}