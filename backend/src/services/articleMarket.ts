import { MarketArticleDTO } from "../../../dto/marketArticleDTO";
import { LeagueRepository } from "../repositories/leagueRepository";
import { LeagueRepositoryD1 } from "../repositories/d1/leagueRepositoryD1";
import { Result, failure, success } from "../repositories/result";
import { WikimediaClient } from "../../../external-apis/wikimedia/client";
import { createWikimediaClient } from "./wikimediaClient";
import {
  TIER_DAYS,
  computeContractPrice,
  normalizedViews,
} from "../../../model/pricing";
import { normalizeLanguageScale } from "../../../model/languageScale";

const MARKET_LIMIT = 50;

export class ArticleMarketService {
  private leagueRepo: LeagueRepository;
  private wikimedia: WikimediaClient;

  constructor(
    db: D1Database,
    wikimedia?: WikimediaClient,
    leagueRepo?: LeagueRepository,
  ) {
    this.leagueRepo = leagueRepo ?? new LeagueRepositoryD1(db);
    this.wikimedia = wikimedia ?? createWikimediaClient();
  }

  async getMarket(leagueId: string): Promise<Result<MarketArticleDTO[]>> {
    const leagueResult = await this.leagueRepo.getById(leagueId);
    if (!leagueResult.ok) {
      return leagueResult;
    }

    const domain = leagueResult.value.domain;

    let topRead;
    try {
      topRead = await this.wikimedia.pageviews.getTopReadList(
        domain,
        MARKET_LIMIT,
      );
    } catch (error) {
      return failure(
        error instanceof Error
          ? error.message
          : "Failed to fetch top read list",
      );
    }

    // The league's own frozen factor. The market grid is where a player reads a
    // price before buying, so it has to be the same number the purchase will use
    // (ADR 0002).
    const languageScale = normalizeLanguageScale(
      leagueResult.value.languageScale,
    );
    const articles: MarketArticleDTO[] = topRead.entries.map((entry) => {
      const averageViews30d = entry.averageViews30d ?? 0;
      const normalized = normalizedViews(averageViews30d, languageScale);
      return {
        id: entry.canonicalTitle,
        title: entry.displayTitle,
        slug: entry.canonicalTitle,
        yesterdayViews: entry.dailyViews,
        weekViews: entry.weekViews ?? 0,
        monthViews: entry.monthViews ?? 0,
        yearViews: entry.yearViews ?? 0,
        averageViews30d,
        price: computeContractPrice(normalized, TIER_DAYS.MEDIUM),
        owner: null,
      };
    });

    return success(articles);
  }
}
