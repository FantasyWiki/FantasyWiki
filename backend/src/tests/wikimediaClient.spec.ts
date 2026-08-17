import { describe, expect, it, vi } from "vitest";
import { createWikimediaClient } from "../services/wikimediaClient";
import { buildRoutedFetch } from "../../../external-apis/wikimedia/test-utils/fixtures";

describe("services/wikimediaClient", () => {
  it("uses external-api positional API in backend module", async () => {
    // Routed by URL, not by call order: `getTopReadList` also fetches the
    // edition's namespace list, and a positional chain would feed that request
    // the top-read body.
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockImplementation(buildRoutedFetch({}));

    const client = createWikimediaClient({
      fetchFn,
      cache: null,
    });

    const result = await client.pageviews.getTopReadList("en", 5);

    expect(result.domain).toBe("en");
    expect(result.entries.length).toBeGreaterThan(0);
    expect(fetchFn).toHaveBeenCalled();
  });
});
