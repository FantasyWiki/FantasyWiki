import type { Domain } from "../../../dto/enums";
import {
    PAGEVIEWS_BASE_URL,
    fetchJsonWithRetry,
    shiftUtcDays,
    toDateParts,
    toYmd,
} from "./internal";
import {CacheLike, WikimediaHttp} from "../client";
import {WikimediaTopReadArticle} from "../wikimedia";

export type DomainResponse = {
    items: Array<DomainResult>;
};

export type DomainResult = {
    domain: Domain;
    snapshotDate: string;
    views: number;
};

export type GetViewsByDomainDeps = {
    http: WikimediaHttp;
    cache: CacheLike | null;
    maxFallbackDays: number;
    retryCount: number;
};

export function createGetViewsByDomain(deps: GetViewsByDomainDeps) {
    const { http, cache, maxFallbackDays, retryCount } = deps;

    return async function getViewsByDomain(domain: Domain): Promise<DomainResult> {

        const baseDate = new Date();
        for (let offset = 1; offset <= maxFallbackDays; offset += 1) {
            const snapshotDate = shiftUtcDays(baseDate, -offset);
            const snapshotDateText = toYmd(snapshotDate);
            const cacheKey = `wikimedia:aggregate:${domain}.wikipedia.org:${snapshotDateText}:`;

            let cached: string | null = null;
            try {
                cached = cache?.getItem(cacheKey) ?? null;
            } catch {
                cached = null;
            }

            if (cached) {
                try {
                    return JSON.parse(cached) as DomainResult;
                } catch {
                    try { cache?.removeItem(cacheKey); } catch { /* best-effort */ }
                }
            }

            const parts = toDateParts(snapshotDate);
            const url = `${PAGEVIEWS_BASE_URL}/aggregate/${domain}.wikipedia.org/all-access/user/daily/${parts.year}${parts.month}${parts.day}/${parts.year}${parts.month}${parts.day}`;


            try {
                const domainViews = await fetchJsonWithRetry<DomainResponse>(http, url, retryCount);

                const result: DomainResult = {
                    domain,
                    snapshotDate: snapshotDateText,
                    views: domainViews.items[0].views
                };

                try { cache?.setItem(cacheKey, JSON.stringify(result)); } catch { /* best-effort */ }
                return result;
            } catch {
                // Fall back to the previous day's snapshot when this date is unavailable.
            }
        }

        throw new Error("Total views unavailable");
    };
}