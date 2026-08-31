import {
  createWikimediaClient as createSharedWikimediaClient,
  createFetchHttp,
  type WikimediaClientOptions,
} from "../../../external-apis/wikimedia/client";

// Wikimedia's APIs REQUIRE a descriptive, contactable User-Agent (ADR 0004):
// a UA-less request is answered with 403, which the view-resolvers swallow into
// `undefined` views — silently pricing every contract at 0. The browser client
// gets a UA for free; the Worker must set one explicitly. `Api-User-Agent` is
// the header api.wikimedia.org (search) reads, `User-Agent` is what the REST
// pageviews host reads — send both. (Setting User-Agent is allowed in the
// Worker runtime; a browser would strip it as a forbidden header, but the
// browser uses a different client path.)
const USER_AGENT =
  "FantasyWiki/1.0 (https://github.com/FantasyWiki/FantasyWiki)";

// `fetch`, not a client library: the Worker runtime rejects the `cache: "default"`
// that axios >=1.20 puts on the Request its fetch adapter builds, with
// `TypeError: Unsupported cache mode: default`. Every pageview lookup threw,
// and `resolveArticleViews` swallows a throw into undefined views, so contracts
// stopped pricing with no error anywhere but the response.
export function createWikimediaClient(options: WikimediaClientOptions = {}) {
  if (options.http || options.fetchFn) {
    return createSharedWikimediaClient(options);
  }

  return createSharedWikimediaClient({
    ...options,
    http: createFetchHttp(fetch, {
      "User-Agent": USER_AGENT,
      "Api-User-Agent": USER_AGENT,
    }),
  });
}
