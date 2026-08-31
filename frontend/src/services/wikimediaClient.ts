import {
  createWikimediaClient as createFrontendWikimediaClient,
  type WikimediaClientOptions,
} from "../../../external-apis/wikimedia/client";

// No transport of its own: the shared client already defaults to `fetch`, which
// reports a non-2xx as a status rather than throwing — the one thing the axios
// adapter this replaced was configured for. The browser supplies the User-Agent
// Wikimedia requires, so unlike the backend there are no headers to add.
export function createWikimediaClient(options: WikimediaClientOptions = {}) {
  return createFrontendWikimediaClient(options);
}
