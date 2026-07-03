import { env } from "cloudflare:workers";
import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect } from "vitest";
import { ArticleMarketService } from "../../services/articleMarket";
import { LeagueRepository } from "../../repositories/leagueRepository";
import { success, failure } from "../../repositories/result";
import { League } from "../../../../model";
import { WikimediaClient } from "../../../../external-apis/wikimedia/client";
import { TopReadEntry } from "../../../../external-apis/wikimedia/wikimedia";

const sampleLeague: League = {
  id: "global",
  name: "Global League",
  adminId: "system",
  startDate: Temporal.Now.instant(),
  endDate: Temporal.Now.instant(),
  domain: "en",
  icon: "🌍",
};

function leagueRepoReturning(league: League): LeagueRepository {
  return { getById: async () => success(league) };
}

/**
 * Build a WikimediaClient stub whose only exercised capability is
 * `pageviews.getTopReadList`. The remaining namespaces throw so an accidental
 * dependency on them surfaces immediately instead of silently passing.
 */
function wikimediaClientWithTopRead(
  getTopReadList: WikimediaClient["pageviews"]["getTopReadList"],
): WikimediaClient {
  const unimplemented = () => {
    throw new Error("not implemented in stub");
  };
  return {
    pageviews: {
      getTopReadList,
      getViewsByDomain: unimplemented,
    },
    article: {
      getSummary: unimplemented,
      getLinkedArticles: unimplemented,
      search: unimplemented,
    },
  } as unknown as WikimediaClient;
}

function topReadEntry(overrides: Partial<TopReadEntry> = {}): TopReadEntry {
  return {
    canonicalTitle: "Albert_Einstein",
    displayTitle: "Albert Einstein",
    sourceRank: 1,
    filteredRank: 1,
    dailyViews: 1000,
    articleUrl: "https://en.wikipedia.org/wiki/Albert_Einstein",
    weekViews: 7000,
    monthViews: 30000,
    yearViews: 365000,
    ...overrides,
  };
}

describe("ArticleMarketService.getMarket", () => {
  it("maps top read entries to MarketArticleDTOs", async () => {
    const wikimedia = wikimediaClientWithTopRead(async () => ({
      domain: "en",
      snapshotDate: "2026-06-29",
      entries: [topReadEntry()],
    }));
    const service = new ArticleMarketService(
      env.db,
      wikimedia,
      leagueRepoReturning(sampleLeague),
    );

    const result = await service.getMarket("global");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([
        {
          id: "Albert_Einstein",
          title: "Albert Einstein",
          slug: "Albert_Einstein",
          yesterdayViews: 1000,
          weekViews: 7000,
          monthViews: 30000,
          yearViews: 365000,
          averageViews30d: 0,
          // ADR 0005: genuinely 0 for sub-2,000-view (here, zero-view) articles —
          // intentional per ADR 0003, not a rounding artifact to floor away.
          price: 0,
          owner: null,
        },
      ]);
    }
  });

  it("defaults missing rolling-window views to zero", async () => {
    const wikimedia = wikimediaClientWithTopRead(async () => ({
      domain: "en",
      snapshotDate: "2026-06-29",
      entries: [
        topReadEntry({
          weekViews: undefined,
          monthViews: undefined,
          yearViews: undefined,
        }),
      ],
    }));
    const service = new ArticleMarketService(
      env.db,
      wikimedia,
      leagueRepoReturning(sampleLeague),
    );

    const result = await service.getMarket("global");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toMatchObject({
        weekViews: 0,
        monthViews: 0,
        yearViews: 0,
      });
    }
  });

  it("computes price from averageViews30d via the ADR 0005 points-based formula", async () => {
    const wikimedia = wikimediaClientWithTopRead(async () => ({
      domain: "en",
      snapshotDate: "2026-06-29",
      entries: [topReadEntry({ averageViews30d: 9000 })],
    }));
    const service = new ArticleMarketService(
      env.db,
      wikimedia,
      leagueRepoReturning(sampleLeague),
    );

    const result = await service.getMarket("global");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0].averageViews30d).toBe(9000);
      // basePoints(9000) = log2(9000/2000) ≈ 2.17; price = D × 2.17^1.7 × 7 (ADR 0005).
      expect(result.value[0].price).toBe(67);
    }
  });

  it("uses the league domain when requesting the top read list", async () => {
    let requestedDomain: string | undefined;
    const wikimedia = wikimediaClientWithTopRead(async (domain) => {
      requestedDomain = domain;
      return { domain, snapshotDate: "2026-06-29", entries: [] };
    });
    const service = new ArticleMarketService(env.db, wikimedia, {
      getById: async () => success({ ...sampleLeague, domain: "it" }),
    });

    const result = await service.getMarket("global");

    expect(result.ok).toBe(true);
    expect(requestedDomain).toBe("it");
  });

  it("propagates a failure when the league cannot be found", async () => {
    const wikimedia = wikimediaClientWithTopRead(async () => {
      throw new Error("should not be called");
    });
    const service = new ArticleMarketService(env.db, wikimedia, {
      getById: async () => failure("league global not found"),
    });

    const result = await service.getMarket("global");

    expect(result).toEqual(failure("league global not found"));
  });

  it("returns a failure with the error message when the Wikimedia call throws", async () => {
    const wikimedia = wikimediaClientWithTopRead(async () => {
      throw new Error("upstream timeout");
    });
    const service = new ArticleMarketService(
      env.db,
      wikimedia,
      leagueRepoReturning(sampleLeague),
    );

    const result = await service.getMarket("global");

    expect(result).toEqual(failure("upstream timeout"));
  });

  it("returns a generic failure when a non-Error value is thrown", async () => {
    const wikimedia = wikimediaClientWithTopRead(async () => {
      throw "boom";
    });
    const service = new ArticleMarketService(
      env.db,
      wikimedia,
      leagueRepoReturning(sampleLeague),
    );

    const result = await service.getMarket("global");

    expect(result).toEqual(failure("Failed to fetch top read list"));
  });
});
