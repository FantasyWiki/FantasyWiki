import { describe, it, expect, vi } from "vitest";
import { createWikimediaClient } from "../../services/wikimediaClient";
import { buildRoutedFetch } from "../../../../external-apis/wikimedia/test-utils/fixtures";

describe("createWikimediaClient", () => {
  it("uses the injected fetchFn transport when one is provided", async () => {
    // Routed by URL, not by call order: `getTopReadList` also fetches the
    // edition's namespace list, and a positional chain would feed that request
    // the top-read body.
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockImplementation(buildRoutedFetch({}));

    const client = createWikimediaClient({ fetchFn, cache: null });
    const result = await client.pageviews.getTopReadList("en", 5);

    expect(result.domain).toBe("en");
    expect(result.entries.length).toBeGreaterThan(0);
    expect(fetchFn).toHaveBeenCalled();
  });

  it("exposes the namespaced capabilities when built with default transport", () => {
    const client = createWikimediaClient();

    expect(typeof client.pageviews.getTopReadList).toBe("function");
    expect(typeof client.article.getSummary).toBe("function");
  });
});
