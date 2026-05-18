import {ArticleSummary, createGetSummary } from "./client/getSummary";
import { createGetTopReadList } from "./client/getTopReadList";
import {Domain} from "../../dto/enums";
import {TopReadListResult} from "./client/getTopReadList";
import {createGetViewsByDomain, DomainResult} from "./client/getViewsByDomain";

/**
 * Minimal cache interface used by the shared client.
 *
 * Implementations can be browser `localStorage`, in-memory test doubles,
 * or any runtime-specific storage exposing these methods.
 */
export type CacheLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Transport adapter contract consumed by the shared client.
 *
 * Wrappers can provide Axios/fetch/other adapters as long as they return
 * status + parsed data in this shape.
 */
export type WikimediaHttp = {
    get<T>(url: string): Promise<{ status: number; data: T }>;
};



/**
 * Optional runtime and policy overrides for `createWikimediaClient`.
 */
export type WikimediaClientOptions = {
    http?: WikimediaHttp;
    fetchFn?: typeof fetch;
    cache?: CacheLike | null;
    maxFallbackDays?: number;
    retryCount?: number;
    averageDays?: number;
};

/**
 * Creates the default HTTP adapter based on a Fetch implementation.
 *
 * The Wikimedia client consumes a transport-neutral `WikimediaHttp` contract;
 * this adapter converts fetch responses to that shape.
 *
 * @param fetchFn - Fetch implementation to use (native or injected).
 * @returns Transport adapter exposing `get(url) -> { status, data }`.
 */
function createFetchHttp(fetchFn: typeof fetch): WikimediaHttp {
    return {
        async get<T>(url: string): Promise<{ status: number; data: T }> {
            const response = await fetchFn(url);
            const data = (await response.json()) as T;
            return { status: response.status, data };
        },
    };
}

/**
 * Resolves the default cache implementation for browser runtimes.
 *
 * This is intentionally best-effort:
 * - non-browser runtimes return `null`
 * - storage access failures return `null`
 *
 * @returns `localStorage` when available and accessible, otherwise `null`.
 */
export function getDefaultCache(): CacheLike | null {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

/**
 * Public client API exposed to application code.
 */
export type WikimediaClient = {
    pageviews: {
        getTopReadList(domain: Domain, limit: number): Promise<TopReadListResult>,
        getViewsByDomain(domain: Domain): Promise<DomainResult>;

    };
    article: {
        getSummary(domain: Domain, title: string): Promise<ArticleSummary>;
    };
};

/**
 * Creates the shared Wikimedia client used by frontend and backend wrappers.
 *
 * How to use:
 * - call `createWikimediaClient()` for defaults
 * - inject `http` or `fetchFn` to customize transport/testing
 * - call namespaced capabilities, e.g. `client.pageviews.getTopReadList(...)`
 *
 * How to extend with new behavior:
 * 1. Add a new capability factory under `external-apis/wikimedia/client/`
 * 2. Reuse shared helpers injected from this composition root
 * 3. Expose the capability under a new namespace in the returned object
 *
 * This keeps existing namespaces stable while allowing additive extension.
 *
 * @param options - Runtime and policy overrides for transport, cache, clock, and retry behavior.
 * @returns Configured Wikimedia client with namespaced capabilities.
 */
export function createWikimediaClient(options: WikimediaClientOptions = {}): WikimediaClient {
    const {
        fetchFn = fetch,
        cache = getDefaultCache(),
        maxFallbackDays = 2,
        retryCount = 2,
        averageDays = 30,
    } = options;

    const http = options.http ?? createFetchHttp(fetchFn);

    return {
        pageviews: {
            getTopReadList: createGetTopReadList({
                http, cache, maxFallbackDays, retryCount, averageDays,
            }),
            getViewsByDomain: createGetViewsByDomain({ http, cache, maxFallbackDays, retryCount }),
        },
        article: {
            getSummary: createGetSummary({ http, retryCount }),
        },
    };
}