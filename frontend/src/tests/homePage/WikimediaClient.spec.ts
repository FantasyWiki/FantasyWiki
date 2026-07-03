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
  it("returns article summary with extract and thumbnail", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        title: "ChatGPT",
        extract: "ChatGPT is a chatbot by OpenAI.",
        thumbnail: { source: "https://upload.wikimedia.org/chatgpt.jpg" },
      })
    );

    const client = createWikimediaClient({
      fetchFn,
      cache: null,
    });

    const result = await client.article.getSummary("en", "ChatGPT");

    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining(
        "https://en.wikipedia.org/api/rest_v1/page/summary/ChatGPT"
      )
    );
    expect(result).toEqual({
      title: "ChatGPT",
      extract: "ChatGPT is a chatbot by OpenAI.",
      thumbnailUrl: "https://upload.wikimedia.org/chatgpt.jpg",
    });
  });

  it("ignores corrupt cache entries and falls back to network", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
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
      cache,
    });

    const result = await client.pageviews.getTopReadList("en", 5);

    expect(result.entries.length).toBeGreaterThan(0);
    expect(cache.removeItem).toHaveBeenCalledTimes(1);
  });

  it("keeps entries when 30d average lookup fails for an article", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
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
      cache: null,
    });

    const result = await client.pageviews.getTopReadList("en", 5);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].averageViews30d).toBeUndefined();
  });

  it("article.search returns entries filtered by isContentArticleTitle and enriched with views", async () => {
    const searchPayload = {
      pages: [
        { key: "Photosynthesis", title: "Photosynthesis" },
        { key: "Special:Random", title: "Special:Random" }, // should be filtered out
        { key: "Chlorophyll", title: "Chlorophyll" },
      ],
    };
    const perArticleViews = buildPerArticleViewsResponse(
      Array.from({ length: 365 }, () => 200)
    );

    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(searchPayload))
      .mockResolvedValue(jsonResponse(perArticleViews));

    const client = createWikimediaClient({ fetchFn, cache: null });
    const results = await client.article.search("en", "photo", 5);

    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining(
        "api.wikimedia.org/core/v1/wikipedia/en/search/page"
      )
    );
    // Special:Random filtered out
    expect(results.map((r) => r.canonicalTitle)).not.toContain(
      "Special:Random"
    );
    expect(results.map((r) => r.canonicalTitle)).toContain("Photosynthesis");
    expect(results.map((r) => r.canonicalTitle)).toContain("Chlorophyll");
    // Views enriched
    expect(results[0].weekViews).toBe(200 * 7);
  });

  it("returns cached links without calling fetch when cache hits", async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const mockCache = {
      getItem: vi.fn().mockReturnValue(
        JSON.stringify({
          value: {
            title: "Albert Einstein",
            linkedArticles: ["Isaac Newton", "Physics"],
          },
          expiresAt: Date.now() + 100000,
        })
      ),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    const client = createWikimediaClient({
      fetchFn,
      cache: mockCache,
    });

    const result = await client.article.getLinkedArticles(
      "en",
      "Albert Einstein"
    );

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result).toEqual({
      title: "Albert Einstein",
      linkedArticles: ["Isaac Newton", "Physics"],
    });
    expect(mockCache.getItem).toHaveBeenCalledWith(
      "wikimedia:links:v2:en.wikipedia:Albert_Einstein"
    );
  });
});
