import type { Domain } from "../../../model/enums";
import type { WikimediaTopReadArticle } from "../wikimedia";
import {
  MAX_CONCURRENT_REQUESTS,
  PAGEVIEWS_BASE_URL,
  fetchJsonWithRetry,
  mapWithLimit,
  shiftUtcDays,
  toDateParts,
  toYmd,
  withCache,
} from "./internal";
import { CacheLike, WikimediaHttp } from "../client";
import type { TopReadResponse } from "./getTopReadList";

export type DailyTopArticles = {
  domain: Domain;
  /** The day these views are for, `YYYY-MM-DD` UTC. */
  date: string;
  /** Raw, unfiltered and unranked-over: whatever the endpoint returned, up to 1,000. */
  articles: WikimediaTopReadArticle[];
};

/**
 * One day's top-read list, raw — the same `/top` endpoint `getTopReadList`
 * uses, without the per-article fan-out that hydrates it.
 *
 * The distinction is the whole point of this module existing beside that one.
 * `getTopReadList` answers "what should the market show", so it filters to
 * content articles, truncates to a limit and spends one `/per-article` request
 * per entry to fill in each one's view series. Language Scale calibration wants
 * the opposite trade: *every* title the payload carries, with only the day's own
 * view count, because it needs 30 days of them and the day's count is already in
 * this response. That turns a ~501-request calibration into a ~31-request one
 * (issue #532), and the two routes agree on `L` to within 1.5% — see
 * docs/domain/language-editions.md.
 *
 * A day Wikimedia has no list for resolves to `null` rather than throwing. The
 * caller is averaging a window, and one absent day in thirty is a smaller error
 * than refusing to calibrate at all; a caller that needs the day to exist can
 * check. Past days are immutable, which is why this is cached with no TTL where
 * a cache exists at all.
 */
export function createGetDailyTopArticles(
  http: WikimediaHttp,
  cache: CacheLike | null,
  retryCount: number,
) {
  return async function getDailyTopArticles(
    domain: Domain,
    date: Date,
  ): Promise<DailyTopArticles | null> {
    const dateText = toYmd(date);
    const parts = toDateParts(date);
    const url = `${PAGEVIEWS_BASE_URL}/top/${domain}.wikipedia/all-access/${parts.year}/${parts.month}/${parts.day}`;
    const cacheKey = `wikimedia:daily-top:${domain}.wikipedia:${dateText}`;

    try {
      return await withCache(cache, cacheKey, async () => {
        const response = await fetchJsonWithRetry<TopReadResponse>(
          http,
          url,
          retryCount,
        );
        return {
          domain,
          date: dateText,
          articles: response.items?.[0]?.articles ?? [],
        };
      });
    } catch {
      return null;
    }
  };
}

/**
 * A window of consecutive days' top-read lists, most recent first.
 *
 * The fan-out lives here rather than in the calling service for the reason every
 * other fan-out in this client does: `MAX_CONCURRENT_REQUESTS` is the shared
 * policy Wikimedia asks for (ADR 0004), and a caller that assembled its own
 * 30-request burst would be the one place that ignored it.
 *
 * The window ends *yesterday*, not today: today's list does not exist yet. Days
 * Wikimedia has no list for come back as `null` in place rather than shortening
 * the array, so a caller can tell "no data for that day" from "fewer days than I
 * asked for" — early in a UTC day even yesterday's list may not be published,
 * and calibration averages over the days it got rather than refusing.
 */
export function createGetDailyTopWindow(
  getDailyTopArticles: ReturnType<typeof createGetDailyTopArticles>,
) {
  return async function getDailyTopWindow(
    domain: Domain,
    days: number,
    endingDaysAgo = 1,
  ): Promise<Array<DailyTopArticles | null>> {
    const today = new Date();
    const dates = Array.from({ length: days }, (_, index) =>
      shiftUtcDays(today, -(endingDaysAgo + index)),
    );

    return mapWithLimit(dates, MAX_CONCURRENT_REQUESTS, (date) =>
      getDailyTopArticles(domain, date),
    );
  };
}
