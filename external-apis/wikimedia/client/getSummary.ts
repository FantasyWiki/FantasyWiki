import type { Domain } from "../../../dto/enums";
import { fetchJsonWithRetry } from "./internal";
import { wikipediaRestUrl} from "./internal";
import {WikimediaHttp} from "../client";

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

export type GetSummaryDeps = {
    http: WikimediaHttp;
    retryCount: number;
};

export function createGetSummary(deps: GetSummaryDeps) {
    return async function getSummary(domain: Domain, title: string): Promise<ArticleSummary> {
        const encodedTitle = encodeURIComponent(title).replace(/%20/g, "_");
        const url = wikipediaRestUrl(domain,`/page/summary/${encodedTitle}`);

        const response = await fetchJsonWithRetry<ArticleSummaryResponse>(
            deps.http,
            url,
            deps.retryCount,
        );

        return {
            title: response.title ?? title,
            extract: response.extract ?? "",
            thumbnailUrl: response.thumbnail?.source,
        };
    };
}