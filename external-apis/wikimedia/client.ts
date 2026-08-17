import {ArticleSummary, createGetSummary} from "./client/getSummary";
import {createGetTopReadList, TopReadListResult} from "./client/getTopReadList";
import {Domain} from "../../model/enums";
import {createGetViewsByDomain, DomainResult} from "./client/getViewsByDomain";
import {createGetLinks, articleWithLinks} from "./client/getLinks";
import {ArticleViews, createResolveArticleViews, createResolveArticleViewsWithFallback} from "./client/articleViews";
import {createSearchArticles, createSearchTitles} from "./client/searchArticles";
import {createGetDailyTopArticles, createGetDailyTopWindow, DailyTopArticles} from "./client/getDailyTopArticles";
import {createGetSiteNamespaces} from "./client/getSiteNamespaces";
import {createListEditions} from "./client/listEditions";
import {ArticleSearchHit, SiteNamespaces, TopReadEntry, WikipediaEdition} from "./wikimedia";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Minimal cache interface used by the shared client.
 *
 * Implementations can wrap browser `localStorage`, in-memory test doubles,
 * or any runtime-specific storage.
 *
 * `ttlMs` is an optional default time-to-live, in milliseconds, applied
 * to entries managed by this cache implementation.
 */
export type CacheLike = Pick<Storage, "getItem" | "setItem" | "removeItem"> & {
    ttlMs?: number;
};

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

export function setTtl(
    cache: CacheLike | null | undefined,
    ttlMs: number,
): CacheLike | null {
    if (!cache) return null;

    return {
        ...cache,
        ttlMs,
    };
}

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
 *
 * @returns `localStorage` when available and accessible, otherwise `null`.
 * @param ttlMs - the ttl of the cache in milliseconds. If not provided, entries do not expire automatically.
 */
export function getDefaultCache(ttlMs?: number): CacheLike | null {
    try {
        const storage = (globalThis as { localStorage?: Storage }).localStorage;
        if (!storage) return null;

        return {
            getItem: storage.getItem.bind(storage),
            setItem: storage.setItem.bind(storage),
            removeItem: storage.removeItem.bind(storage),
            ttlMs: ttlMs, // default 24h
        };
    } catch {
        return null;
    }
}

/**
 * Public client API exposed to application code.
 */
export type WikimediaClient = {
    pageviews: {
        /**
         * `onPartial` (optional) reports the list as it fills: once from the
         * top-read payload alone, then after each article's view series lands.
         * Callers that omit it simply await the complete result.
         */
        getTopReadList(
            domain: Domain,
            limit: number,
            onPartial?: (partial: TopReadListResult) => void,
        ): Promise<TopReadListResult>,
        getViewsByDomain(domain: Domain): Promise<DomainResult>;
        /** Latest views/trend for a single article, independent of the top-read list. */
        getArticleViews(domain: Domain, title: string): Promise<ArticleViews>;
        /**
         * One day's `/top` payload, raw and unhydrated — every title it carries
         * with that day's own view count, and no per-article fan-out. `null`
         * for a day Wikimedia has no list for. This is what makes Language
         * Scale calibration ~31 requests instead of ~501 (#532).
         */
        getDailyTopArticles(
            domain: Domain,
            date: Date,
        ): Promise<DailyTopArticles | null>;
        /**
         * `days` consecutive daily lists, most recent first, ending
         * `endingDaysAgo` days before today (yesterday by default — today's
         * list does not exist yet). A day with no published list is `null` in
         * place, so the array is always `days` long.
         */
        getDailyTopWindow(
            domain: Domain,
            days: number,
            endingDaysAgo?: number,
        ): Promise<Array<DailyTopArticles | null>>;
    };
    article: {
        getSummary(domain: Domain, title: string): Promise<ArticleSummary>;
        getLinkedArticles(domain: Domain, title: string): Promise<articleWithLinks>;
        search(domain: Domain, query: string, limit: number): Promise<TopReadEntry[]>;
        /**
         * `search` without the per-article view series: one request, titles and
         * blurbs only. Use it when the answer needed is "which articles exist",
         * not "what are they worth" — `search` costs one 365-day pageview
         * request per hit on top of this.
         */
        searchTitles(domain: Domain, query: string, limit: number): Promise<ArticleSearchHit[]>;
    };
    /**
     * The edition itself, rather than what people read on it: configuration
     * that decides how its titles and its traffic should be interpreted.
     */
    site: {
        /**
         * Which titles on this edition are not content articles, from the
         * edition's own `siteinfo` — the namespace list ADR 0002 requires in
         * place of a hardcoded English prefix list.
         */
        getNamespaces(domain: Domain): Promise<SiteNamespaces>;
        /**
         * Every live Wikipedia language edition, from Sitematrix. The set that
         * *exists*; which of them may host a league is decided by pageviews
         * (#531), not by this list.
         */
        listEditions(): Promise<WikipediaEdition[]>;
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

    const resolveArticleViews = createResolveArticleViews(http, retryCount, averageDays);
    const resolveLatestArticleViews = createResolveArticleViewsWithFallback(
        http, retryCount, averageDays, maxFallbackDays, resolveArticleViews,
    );

    const searchTitles = createSearchTitles(http, setTtl(cache, 7*DAY), retryCount);

    // Shared by the single-day and windowed forms so both go through one cache
    // and one retry policy.
    const dailyTopArticles = createGetDailyTopArticles(http, cache, retryCount);

    return {
        pageviews: {
            getTopReadList: createGetTopReadList(
                http, cache, maxFallbackDays, retryCount, averageDays, resolveArticleViews,
            ),
            getViewsByDomain: createGetViewsByDomain( http, cache, maxFallbackDays, retryCount ),
            getArticleViews: resolveLatestArticleViews,
            // No TTL: a past day's top-read list is immutable, so an entry that
            // is in the cache at all is still correct.
            getDailyTopArticles: dailyTopArticles,
            getDailyTopWindow: createGetDailyTopWindow(dailyTopArticles),
        },
        article: {
            getSummary: createGetSummary( http, setTtl(cache,7*DAY), retryCount ),
            getLinkedArticles: createGetLinks(http, setTtl(cache, 7*DAY), retryCount),
            search: createSearchArticles(
                http, setTtl(cache, 7*DAY), retryCount, resolveArticleViews, searchTitles,
            ),
            searchTitles,
        },
        site: {
            // An edition's namespace configuration changes on the order of
            // never, so it gets the longest TTL any capability here uses.
            getNamespaces: createGetSiteNamespaces(http, setTtl(cache, 30*DAY), retryCount),
            // Same reasoning as the namespace list: new Wikipedia editions are
            // years apart, so this is cached for as long as anything here is.
            listEditions: createListEditions(http, setTtl(cache, 30*DAY), retryCount),
        },
    };
}
