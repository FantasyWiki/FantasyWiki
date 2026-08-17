import type { MarketArticle } from "@/types/market";
import { createWikimediaClient } from "@/services/wikimediaClient";
import type { Domain } from "../../../dto/enums";
import {
  toDisplayTitle,
  type TopReadEntry,
} from "../../../external-apis/wikimedia/wikimedia";
import {
  MAX_CONCURRENT_REQUESTS,
  mapWithLimit,
} from "../../../external-apis/wikimedia/client/internal";
import {
  TIER_DAYS,
  computeContractPrice,
  normalizedViews,
} from "../../../model/pricing";

const client = createWikimediaClient();

const SEARCH_LIMIT = 8;

/**
 * The slice of a TopReadEntry the market listing actually renders. Kept
 * narrower than TopReadEntry so rows built from a bare title (which have no
 * rank and no top-read URL) go through the same construction as top-read rows
 * instead of fabricating fields to satisfy the type.
 */
type MarketArticleSource = Pick<
  TopReadEntry,
  | "canonicalTitle"
  | "displayTitle"
  | "dailyViews"
  | "averageViews30d"
  | "weekViews"
  | "monthViews"
  | "yearViews"
>;

function toMarketArticle(
  entry: MarketArticleSource,
  languageScale: number
): MarketArticle {
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
    // No 30-day average means no view series behind this row: every derived
    // figure below the yesterday count is a placeholder, not a measurement.
    pending: entry.averageViews30d === undefined,
  };
}

/**
 * `onPartial`, when given, is called with the list as it fills — first from the
 * top-read payload alone (one request, every row present but only its yesterday
 * count real), then after each article's view series lands. Rows still waiting
 * are flagged `pending`. Without it, the promise is the only result, unchanged.
 */
export async function fetchMarket(
  domain: Domain,
  languageScale: number,
  onPartial?: (articles: MarketArticle[]) => void
): Promise<MarketArticle[]> {
  const result = await client.pageviews.getTopReadList(
    domain,
    50,
    onPartial &&
      ((partial) =>
        onPartial(
          partial.entries.map((entry) => toMarketArticle(entry, languageScale))
        ))
  );
  return result.entries.map((entry) => toMarketArticle(entry, languageScale));
}

export async function searchMarket(
  domain: Domain,
  languageScale: number,
  query: string
): Promise<MarketArticle[]> {
  const entries = await client.article.search(domain, query, SEARCH_LIMIT);
  return entries.map((entry) => toMarketArticle(entry, languageScale));
}

/** A title to hydrate into a market row, with the price to show if Wikimedia has no history for it. */
export type MarketArticleRequest = {
  title: string;
  fallbackPrice: number;
};

/**
 * Builds market rows for arbitrary titles, for articles the Top Read Snapshot
 * doesn't carry — an owned article can sit anywhere in the domain, not just in
 * the top 50. Priced at the MEDIUM tier like every other row, so hydrated rows
 * stay comparable with the ones that came from the snapshot.
 *
 * One per-article request per title (a 365-day range, plus the day-fallback
 * walk), so the fan-out runs at the client's shared concurrency cap.
 *
 * `getArticleViews` swallows a failed or empty fetch into all-undefined fields
 * rather than throwing, which would otherwise price the row at 0; as in
 * `getContractCurrentPrice`, fall back to the price the row was bought at.
 */
export async function fetchMarketArticlesByTitle(
  domain: Domain,
  languageScale: number,
  requests: MarketArticleRequest[]
): Promise<MarketArticle[]> {
  return mapWithLimit(requests, MAX_CONCURRENT_REQUESTS, async (request) => {
    const canonicalTitle = request.title.trim().replace(/ /g, "_");
    const views = await client.pageviews.getArticleViews(
      domain,
      canonicalTitle
    );
    const article = toMarketArticle(
      {
        canonicalTitle,
        displayTitle: toDisplayTitle(canonicalTitle),
        dailyViews: views.latestDayViews ?? 0,
        averageViews30d: views.averageViews30d,
        weekViews: views.weekViews,
        monthViews: views.monthViews,
        yearViews: views.yearViews,
      },
      languageScale
    );
    // A missing series here is final, not "not yet": clear `pending` so the row
    // renders the fallback price instead of a placeholder dash.
    return views.averageViews30d === undefined
      ? { ...article, price: request.fallbackPrice, pending: false }
      : article;
  });
}
