import { describe, expect, it, vi } from "vitest";
import { createWikimediaClient } from "@/services/wikimediaClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("services/wikimediaClient", () => {
  it("falls back up to 2 days and returns filtered top list with volume", async () => {
    const fetchFn = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse({ error: "missing" }, 404))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              project: "en.wikipedia",
              access: "all-access",
              year: "2026",
              month: "04",
              day: "27",
              articles: [
                { article: "Main_Page", views: 5000, rank: 1 },
                { article: "Special:Search", views: 4000, rank: 2 },
                { article: "ChatGPT", views: 3000, rank: 3 },
                { article: "Pope_Francis", views: 2000, rank: 4 },
                { article: "A_Minecraft_Movie", views: 1000, rank: 5 },
              ],
            },
          ],
        })
      )
      .mockResolvedValue(
        jsonResponse({ items: [{ views: 10 }, { views: 20 }] })
      );

    const client = createWikimediaClient({
      fetchFn,
      now: () => new Date("2026-04-29T12:00:00.000Z"),
      storage: null,
    });

    const result = await client.pageviews.getTopReadList({
      domain: "en",
      limit: 5,
    });

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

  it("keeps entries when 30d average lookup fails for an article", async () => {
    const fetchFn = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              project: "en.wikipedia",
              access: "all-access",
              year: "2026",
              month: "04",
              day: "28",
              articles: [{ article: "ChatGPT", views: 3000, rank: 1 }],
            },
          ],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));

    const client = createWikimediaClient({
      fetchFn,
      now: () => new Date("2026-04-29T12:00:00.000Z"),
      storage: null,
    });

    const result = await client.pageviews.getTopReadList({
      domain: "en",
      limit: 5,
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].averageViews30d).toBeUndefined();
  });
});
