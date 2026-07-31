import type { Domain } from "../../model/enums";

export type WikimediaTopReadArticle = {
  article: string;
  views: number;
  rank: number;
};

/**
 * A search hit before any pageview work is done: what the search endpoint
 * itself returns, and nothing more.
 *
 * `description` is the one-line blurb the search API supplies (the same text
 * shown under a title in Wikipedia's own search box). It is what lets a
 * consumer classify an article that postdates its own knowledge — see
 * [ADR 0006](../../docs/adr/0006-article-genie.md) — so it is carried here
 * rather than dropped. It is optional because not every page has one.
 */
export type ArticleSearchHit = {
  canonicalTitle: string;
  displayTitle: string;
  description?: string;
};

export type TopReadEntry = {
  canonicalTitle: string;
  displayTitle: string;
  sourceRank: number;
  filteredRank: number;
  dailyViews: number;
  articleUrl: string;
  /** Present on search-derived entries; the top-read payload carries no blurb. */
  description?: string;
  averageViews30d?: number;
  weekViews?: number;
  monthViews?: number;
  yearViews?: number;
};

const EXCLUDED_PREFIXES = [
  "Special:",
  "Wikipedia:",
  "Portal:",
  "Template:",
  "Help:",
  "Category:",
  "File:",
];

const EXCLUDED_EXACT_TITLES = new Set(["Main_Page", "Main Page"]);

export function isContentArticleTitle(title: string): boolean {
  if (EXCLUDED_EXACT_TITLES.has(title)) {
    return false;
  }

  return !EXCLUDED_PREFIXES.some((prefix) => title.startsWith(prefix));
}

export function toDisplayTitle(title: string): string {
  try {
    return decodeURIComponent(title).replace(/_/g, " ");
  } catch {
    return title.replace(/_/g, " ");
  }
}

function buildArticleUrl(domain: Domain, title: string): string {
  return `https://${domain}.wikipedia.org/wiki/${encodeURIComponent(
    title,
  ).replace(/%20/g, "_")}`;
}

export function normalizeTopReadEntries(
  articles: WikimediaTopReadArticle[],
  limit: number,
  domain: Domain = "en",
): TopReadEntry[] {
  let filteredRank = 0;

  return articles
    .filter((article) => isContentArticleTitle(article.article))
    .slice(0, limit)
    .map((article) => {
      filteredRank += 1;
      return {
        canonicalTitle: article.article,
        displayTitle: toDisplayTitle(article.article),
        sourceRank: article.rank,
        filteredRank,
        dailyViews: article.views,
        articleUrl: buildArticleUrl(domain, article.article),
      };
    });
}
