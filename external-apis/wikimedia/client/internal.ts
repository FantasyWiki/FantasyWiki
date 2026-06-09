import {Domain} from "../../../dto/enums";
import {WikimediaHttp} from "../client";

export const PAGEVIEWS_BASE_URL =
    "https://wikimedia.org/api/rest_v1/metrics/pageviews";


/**
 * Build the wikipedia REST API URL for a given domain and path.
 * @param domain - The Wikipedia domain (e.g., "en" for English Wikipedia).
 * @param path the REST API path (e.g., "/page/summary/{title}").
 * @returns The full URL to the Wikipedia REST API endpoint.
 */
export function wikipediaRestUrl(domain: Domain, path: string): string {
    return `https://${domain}.wikipedia.org/api/rest_v1`+ path;
}
/**
 * Formats a numeric date fragment as two digits.
 *
 * Used by UTC date helpers to keep Wikimedia path fragments deterministic
 * (for example, month/day values like `04` instead of `4`).
 *
 * @param value - Numeric date fragment.
 * @returns Two-character decimal string with left zero padding when needed.
 */
export function pad(value: number): string {
    return String(value).padStart(2, "0");
}

/**
 * Converts a Date into canonical `YYYY-MM-DD` UTC format.
 *
 * This format is used for cache keys and snapshot metadata so callers
 * can reason about a single date representation across runtimes.
 *
 * @param date - Date to format.
 * @returns UTC date string in `YYYY-MM-DD` format.
 */
export function toYmd(date: Date): string {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * Shifts a date by a UTC day offset.
 *
 * The helper clones the incoming Date to avoid mutating caller state.
 *
 * @param date - Base UTC date.
 * @param days - Signed day offset (negative for past, positive for future).
 * @returns New Date shifted by the provided UTC day delta.
 */
export function shiftUtcDays(date: Date, days: number): Date {
    const shifted = new Date(date);
    shifted.setUTCDate(shifted.getUTCDate() + days);
    return shifted;
}

/**
 * Splits a UTC date into zero-padded Wikimedia path fragments.
 *
 * Useful for building endpoint paths that expect separate `year/month/day`
 * segments instead of a single combined date.
 *
 * @param date - Source UTC date.
 * @returns Date parts for Wikimedia endpoint path construction.
 */
export function toDateParts(date: Date): { year: string; month: string; day: string } {
    return {
        year: String(date.getUTCFullYear()),
        month: pad(date.getUTCMonth() + 1),
        day: pad(date.getUTCDate()),
    };
}

/**
 * Executes an HTTP GET and retries transient failures with bounded attempts.
 *
 * Retry policy:
 * - retries 429 and 5xx responses
 * - does not retry non-429 4xx responses
 * - retries thrown transport/network errors until attempts are exhausted
 *
 * This helper is shared by all capability modules to keep retry behavior
 * consistent across current and future Wikimedia operations.
 *
 * @typeParam T - Expected response payload shape.
 * @param http - Transport adapter used by the request.
 * @param url - Absolute request URL.
 * @param retryCount - Maximum number of retries after the first attempt.
 * @returns Parsed response payload on success.
 * @throws Error when retries are exhausted or a non-retryable 4xx response occurs.
 */
export async function fetchJsonWithRetry<T>(
    http: WikimediaHttp,
    url: string,
    retryCount: number,
): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
        try {
            const response = await http.get<T>(url);
            if (response.status >= 200 && response.status < 300) {
                return response.data;
            }
            if ((response.status === 429 || response.status >= 500) && attempt < retryCount) {
                continue;
            }
            throw new Error(`HTTP ${response.status}`);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error("Network request failed");
            if (lastError.message.startsWith("HTTP 4") && !lastError.message.startsWith("HTTP 429")) {
                throw lastError;
            }
            if (attempt >= retryCount) {
                throw lastError;
            }
        }
    }

    throw lastError ?? new Error("Network request failed");
}

import { CacheLike } from "../client";

/**
 * Cache-aside helper for asynchronous functions.
 *
 * Behavior:
 * - Attempts to read a JSON value from `cache` using `key`
 * - If a valid (and non-expired) value is found, returns it
 * - If no value exists, the JSON is invalid, or it is expired, calls `fetcher`, stores the result, and returns it
 *
 * TTL:
 * - If `cache.ttlMs` is provided, entries older than that are considered expired
 * - If `cache.ttlMs` is not set, entries do not expire automatically
 *
 * @typeParam T - The type of the value returned and stored in the cache
 * @param cache - A `CacheLike` implementation (e.g. `localStorage`) or null
 * @param key - Cache key used to identify the stored value
 * @param fetcher - Async function that produces the value on cache miss or expiry
 * @returns A value of type `T` from cache or computed by `fetcher`
 */
export async function withCache<T>(
    cache: CacheLike | null | undefined,
    key: string,
    fetcher: () => Promise<T>,
): Promise<T> {
    const ttlMs = cache?.ttlMs;

    try {
        const raw = cache?.getItem(key) ?? null;

        if (raw) {
            let parsed;
            try {
                parsed = JSON.parse(raw) as { value?: T; cachedAt?: number };
            } catch {
                cache?.removeItem(key);
                throw new Error("Parse failed"); // Break out of main try block
            }

            const hasTtl = typeof ttlMs === "number" && ttlMs > 0;
            const hasTimestamp = typeof parsed.cachedAt === "number";

            if (!hasTtl || !hasTimestamp) {
                if (typeof parsed.value !== "undefined") {
                    return parsed.value;
                }
                return parsed as unknown as T;
            }

            const now = Date.now();
            if (now - (parsed.cachedAt as number) < ttlMs) {
                if (typeof parsed.value !== "undefined") {
                    return parsed.value;
                }
                return parsed as unknown as T;
            }

            try {
                cache?.removeItem(key);
            } catch {}
        }
    } catch {
        // Ignored
    }

    const value = await fetcher();

    const payload = {
        value,
        cachedAt: Date.now(),
    };

    try {
        cache?.setItem(key, JSON.stringify(payload));
    } catch {
    }

    return value;
}