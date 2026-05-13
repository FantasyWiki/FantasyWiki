import { createGetSummary } from "./client/getSummary";
import { createGetTopReadList } from "./client/getTopReadList";
import type {
  CacheLike,
  WikimediaClient,
  WikimediaClientOptions,
  WikimediaHttp,
} from "./client/public-api";

export type {
  ArticleSummary,
  CacheLike,
  TopReadListResult,
  WikimediaClient,
  WikimediaClientOptions,
  WikimediaHttp,
} from "./client/public-api";

const BASE_URL = "https://wikimedia.org/api/rest_v1/metrics/pageviews";
const BASE_WIKIPEDIA_URL = "https://wikipedia.org/api/rest_v1";

/**
 * Formats a numeric date fragment as two digits.
 *
 * Used by UTC date helpers to keep Wikimedia path fragments deterministic
 * (for example, month/day values like `04` instead of `4`).
 *
 * @param value - Numeric date fragment.
 * @returns Two-character decimal string with left zero padding when needed.
 */
function pad(value: number): string {
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
function toYmd(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`;
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
function shiftUtcDays(date: Date, days: number): Date {
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
function toDateParts(date: Date): { year: string; month: string; day: string } {
  return {
    year: String(date.getUTCFullYear()),
    month: pad(date.getUTCMonth() + 1),
    day: pad(date.getUTCDate()),
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
function getDefaultCache(): CacheLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
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
async function fetchJsonWithRetry<T>(
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

      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < retryCount
      ) {
        continue;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Network request failed");
      if (
        lastError.message.startsWith("HTTP 4") &&
        !lastError.message.startsWith("HTTP 429")
      ) {
        throw lastError;
      }

      if (attempt >= retryCount) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Network request failed");
}

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
export function createWikimediaClient(
  options: WikimediaClientOptions = {},
): WikimediaClient {
  const fetchFn = options.fetchFn ?? fetch;
  const http = options.http ?? createFetchHttp(fetchFn);
  const now = options.now ?? (() => new Date());
  const cache = options.cache === undefined ? getDefaultCache() : options.cache;
  const maxFallbackDays = options.maxFallbackDays ?? 2;
  const retryCount = options.retryCount ?? 2;
  const averageDays = options.averageDays ?? 30;

  const getTopReadList = createGetTopReadList({
    http,
    now,
    cache,
    maxFallbackDays,
    retryCount,
    averageDays,
    baseUrl: BASE_URL,
    toYmd,
    shiftUtcDays,
    toDateParts,
    fetchJsonWithRetry,
  });

  const getSummary = createGetSummary({
    http,
    retryCount,
    baseWikipediaUrl: BASE_WIKIPEDIA_URL,
    fetchJsonWithRetry,
  });

  return {
    pageviews: {
      getTopReadList,
    },
    article: {
      getSummary,
    },
  };
}
