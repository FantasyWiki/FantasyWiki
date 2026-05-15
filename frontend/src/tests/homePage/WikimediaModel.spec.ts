import { describe, expect, it } from "vitest";
import { normalizeTopReadEntries } from "../../../../external-apis/wikimedia/wikimedia";

describe("model/wikimedia", () => {
  it("filters non-content entries and reassigns filtered rank", () => {
    const entries = normalizeTopReadEntries(
      [
        { article: "Main_Page", views: 5000, rank: 1 },
        { article: "Special:Search", views: 4000, rank: 2 },
        { article: "ChatGPT", views: 3000, rank: 3 },
        { article: "Portal:Current_events", views: 2000, rank: 4 },
        { article: "Pope_Francis", views: 1000, rank: 5 },
      ],
      5
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      canonicalTitle: "ChatGPT",
      displayTitle: "ChatGPT",
      sourceRank: 3,
      filteredRank: 1,
      dailyViews: 3000,
    });
    expect(entries[1]).toMatchObject({
      canonicalTitle: "Pope_Francis",
      displayTitle: "Pope Francis",
      sourceRank: 5,
      filteredRank: 2,
      dailyViews: 1000,
    });
  });
});
