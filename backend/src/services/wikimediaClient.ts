import axios from "axios";
import {
  createWikimediaClient as createSharedWikimediaClient,
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

function createAxiosHttp() {
  return {
    async get<T>(url: string): Promise<{ status: number; data: T }> {
      const response = await axios.get<T>(url, {
        validateStatus: () => true,
        headers: {
          "User-Agent": USER_AGENT,
          "Api-User-Agent": USER_AGENT,
        },
      });
      return { status: response.status, data: response.data };
    },
  };
}

export function createWikimediaClient(options: WikimediaClientOptions = {}) {
  if (options.http || options.fetchFn) {
    return createSharedWikimediaClient(options);
  }

  return createSharedWikimediaClient({ ...options, http: createAxiosHttp() });
}
