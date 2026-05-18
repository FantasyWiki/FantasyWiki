import axios from "axios";
import {
  createWikimediaClient as createFrontendWikimediaClient,
  type WikimediaClientOptions,
} from "../../../external-apis/wikimedia/client";

function createAxiosHttp() {
  return {
    async get<T>(url: string): Promise<{ status: number; data: T }> {
      const response = await axios.get<T>(url, { validateStatus: () => true });
      return { status: response.status, data: response.data };
    },
  };
}

export function createWikimediaClient(options: WikimediaClientOptions = {}) {
  if (options.http || options.fetchFn) {
    return createFrontendWikimediaClient(options);
  }

  return createFrontendWikimediaClient({ ...options, http: createAxiosHttp() });
}
