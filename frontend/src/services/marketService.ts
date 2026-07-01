import type { MarketArticle } from "@/types/market";
import { createWikimediaClient } from "@/services/wikimediaClient";
import type { Domain } from "../../../dto/enums";
import type { TopReadEntry } from "../../../external-apis/wikimedia/wikimedia";
import {
  TIER_DAYS,
  computeContractPrice,
  normalizedViews,
  resolveLanguageScale,
} from "../../../model/pricing";

const client = createWikimediaClient();

const SEARCH_LIMIT = 8;

function toMarketArticle(entry: TopReadEntry, domain: Domain): MarketArticle {
  const averageViews30d = entry.averageViews30d ?? 0;
  const normalized = normalizedViews(averageViews30d, resolveLanguageScale(domain));
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
}

export async function fetchMarket(domain: Domain): Promise<MarketArticle[]> {
  const result = await client.pageviews.getTopReadList(domain, 50);
  return result.entries.map((entry) => toMarketArticle(entry, domain));
}

export async function searchMarket(
  domain: Domain,
  query: string
): Promise<MarketArticle[]> {
  const entries = await client.article.search(domain, query, SEARCH_LIMIT);
  return entries.map((entry) => toMarketArticle(entry, domain));
}
