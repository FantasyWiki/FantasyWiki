import { WikimediaClient } from "../../../../external-apis/wikimedia/client";

/**
 * Wikimedia stubs. No test may build the real client: it is a network call, so
 * it would make pricing non-deterministic and tie the suite to Wikipedia being
 * reachable. `createWikimediaClient` belongs only to the tests of the client
 * itself, which inject their own `fetchFn`.
 */

function unimplemented(): never {
  throw new Error("not implemented in stub");
}

export function wikimediaWithArticleViews(
  getArticleViews: WikimediaClient["pageviews"]["getArticleViews"],
): WikimediaClient {
  return {
    pageviews: {
      getArticleViews,
      getTopReadList: unimplemented,
      getViewsByDomain: unimplemented,
    },
    article: {
      getSummary: unimplemented,
      getLinkedArticles: unimplemented,
      search: unimplemented,
    },
  } as unknown as WikimediaClient;
}

/**
 * `averageViews30d` is the only figure the pricing engine reads (ADR 0005), so
 * answering just that one prices every article predictably.
 */
export function wikimediaWithAvg(
  averageViews30d: number | undefined,
): WikimediaClient {
  return wikimediaWithArticleViews(async () => ({
    latestDayViews: undefined,
    averageViews30d,
    weekViews: undefined,
    previousWeekViews: undefined,
    monthViews: undefined,
    yearViews: undefined,
  }));
}

/**
 * For a subject that prices nothing. Only `buyContract` and `settleDueContract`
 * read pageviews, so the contract reads, the sale and the renewal election all
 * get this: it names what was touched instead of returning a plausible number,
 * so a path that starts depending on live data fails loudly.
 */
export function unusedWikimedia(): WikimediaClient {
  return new Proxy({} as WikimediaClient, {
    get(_target, property) {
      throw new Error(
        `This test injected no WikimediaClient, but something read ${String(property)}`,
      );
    },
  });
}
