import type { MarketArticle } from "@/types/market";
import { createWikimediaClient } from "@/services/wikimediaClient";
import type { Domain } from "../../../dto/enums";

const client = createWikimediaClient();

const SEARCH_LIMIT = 8;

export async function fetchMarket(domain: Domain): Promise<MarketArticle[]> {
  const result = await client.pageviews.getTopReadList(domain, 50);
  return result.entries.map((entry) => ({
    id: entry.canonicalTitle,
    title: entry.displayTitle,
    slug: entry.canonicalTitle,
    yesterdayViews: entry.dailyViews,
    weekViews: entry.weekViews ?? 0,
    monthViews: entry.monthViews ?? 0,
    yearViews: entry.yearViews ?? 0,
    owner: null,
  }));
}

export async function searchMarket(
  domain: Domain,
  query: string
): Promise<MarketArticle[]> {
  const entries = await client.article.search(domain, query, SEARCH_LIMIT);
  return entries.map((entry) => ({
    id: entry.canonicalTitle,
    title: entry.displayTitle,
    slug: entry.canonicalTitle,
    yesterdayViews: entry.dailyViews,
    weekViews: entry.weekViews ?? 0,
    monthViews: entry.monthViews ?? 0,
    yearViews: entry.yearViews ?? 0,
    owner: null,
  }));
}
