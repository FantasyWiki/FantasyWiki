import { describe, expect, it, vi } from "vitest";
import { createWikimediaClient } from "../../../../external-apis/wikimedia/client";
import {
  buildTopReadResponse,
  buildPerArticleViewsResponse,
} from "../../../../external-apis/wikimedia/test-utils/fixtures";

const topReadArticles = [
  { article: "Main_Page", views: 5000, rank: 1 },
  { article: "Special:Search", views: 4000, rank: 2 },
  { article: "ChatGPT", views: 3000, rank: 3 },
  { article: "Pope_Francis", views: 2000, rank: 4 },
  { article: "A_Minecraft_Movie", views: 1000, rank: 5 },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("external-apis/wikimedia/client", () => {
  it("supports positional API and returns normalized top-read data", async () => {
    const fetchFn = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse({ error: "missing" }, 404))
      .mockResolvedValueOnce(
        jsonResponse(buildTopReadResponse({ articles: topReadArticles }))
      )
      .mockResolvedValue(jsonResponse(buildPerArticleViewsResponse([10, 20])));

    const client = createWikimediaClient({
      fetchFn: fetchFn,
      now: () => new Date("2026-04-29T12:00:00.000Z"),
      cache: null,
    });

    const result = await client.pageviews.getTopReadList("en", 5);

    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining("/top/en.wikipedia/all-access/2026/04/28")
    );
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining("/top/en.wikipedia/all-access/2026/04/27")
    );
    expect(result.snapshotDate).toBe("2026-04-27");
    expect(result.filteredSnapshotVolume).toBe(6000);
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0]).toMatchObject({
      canonicalTitle: "ChatGPT",
      filteredRank: 1,
      sourceRank: 3,
      averageViews30d: 15,
    });
  });

  it("ignores corrupt cache entries and falls back to network", async () => {
    const fetchFn = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(
        jsonResponse(buildTopReadResponse({ articles: topReadArticles }))
      )
      .mockResolvedValue(jsonResponse(buildPerArticleViewsResponse([10, 20])));
    const cache = {
      getItem: vi.fn().mockReturnValueOnce("{broken-json"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    const client = createWikimediaClient({
      fetchFn,
      now: () => new Date("2026-04-29T12:00:00.000Z"),
      cache,
    });

    const result = await client.pageviews.getTopReadList("en", 5);

    expect(result.entries.length).toBeGreaterThan(0);
    expect(cache.removeItem).toHaveBeenCalledTimes(1);
  });

  it("returns fetched result even when cache writes fail", async () => {
    const fetchFn = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(
        jsonResponse(buildTopReadResponse({ articles: topReadArticles }))
      )
      .mockResolvedValue(jsonResponse(buildPerArticleViewsResponse([10, 20])));

    const cache = {
      getItem: vi.fn().mockReturnValueOnce(null),
      setItem: vi.fn(() => {
        throw new Error("quota exceeded");
      }),
      removeItem: vi.fn(),
    };

    const client = createWikimediaClient({
      fetchFn,
      now: () => new Date("2026-04-29T12:00:00.000Z"),
      cache,
    });

    const result = await client.pageviews.getTopReadList("en", 5);

    expect(result.filteredSnapshotVolume).toBe(6000);
    expect(cache.setItem).toHaveBeenCalledTimes(1);
  });

  it("keeps entries when 30d average lookup fails for an article", async () => {
    const fetchFn = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(
        jsonResponse(
          buildTopReadResponse({
            articles: [{ article: "ChatGPT", views: 3000, rank: 1 }],
          })
        )
      )
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));

    const client = createWikimediaClient({
      fetchFn,
      now: () => new Date("2026-04-29T12:00:00.000Z"),
      cache: null,
    });

    const result = await client.pageviews.getTopReadList("en", 5);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].averageViews30d).toBeUndefined();
  });
});
