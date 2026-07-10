import { describe, expect, it, vi } from "vitest";
import { createWikimediaClient } from "../services/wikimediaClient";
import {
  buildPerArticleViewsResponse,
  buildTopReadResponse,
} from "../../../external-apis/wikimedia/test-utils/fixtures";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("services/wikimediaClient", () => {
  it("uses external-api positional API in backend module", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(buildTopReadResponse({})))
      .mockResolvedValue(jsonResponse(buildPerArticleViewsResponse([10, 20])));

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
