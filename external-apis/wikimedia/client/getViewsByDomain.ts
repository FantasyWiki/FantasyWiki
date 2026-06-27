import type { Domain } from "../../../model/enums";
import {
    PAGEVIEWS_BASE_URL,
    fetchJsonWithRetry,
    shiftUtcDays,
    toDateParts,
    toYmd,
    withCache,
} from "./internal";
import { CacheLike, WikimediaHttp } from "../client";

export type DomainResponse = {
    items: Array<DomainResult>;
};

export type DomainResult = {
    domain: Domain;
    snapshotDate: string;
    views: number;
};

export function createGetViewsByDomain(http: WikimediaHttp,
cache: CacheLike | null,
maxFallbackDays: number,
retryCount: number) {

    return async function getViewsByDomain(domain: Domain): Promise<DomainResult> {
        const baseDate = new Date();

        for (let offset = 1; offset <= maxFallbackDays; offset += 1) {
            const snapshotDate = shiftUtcDays(baseDate, -offset);
            const snapshotDateText = toYmd(snapshotDate);
            const cacheKey = `wikimedia:aggregate:${domain}.wikipedia.org:${snapshotDateText}:`;

            const parts = toDateParts(snapshotDate);
            const url = `${PAGEVIEWS_BASE_URL}/aggregate/${domain}.wikipedia.org/all-access/user/daily/${parts.year}${parts.month}${parts.day}/${parts.year}${parts.month}${parts.day}`;

            try {
                return await withCache(cache, cacheKey, async () => {
                    const domainViews = await fetchJsonWithRetry<DomainResponse>(http, url, retryCount);

                    return {
                        domain,
                        snapshotDate: snapshotDateText,
                        views: domainViews.items[0].views,
                    };
                });
            } catch {
            }
        }

        throw new Error("Total views unavailable");
    };
}