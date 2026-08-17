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

/**
 * One live Wikipedia language edition, as Wikimedia's own registry states it.
 *
 * Both names are carried because they answer different questions: the autonym is
 * what a reader of that edition recognises, and the English name is what someone
 * who cannot type the autonym can search for.
 */
export type WikipediaEdition = {
  /** The language code, which is also the `leagues.domain` value and the URL host prefix. */
  code: string;
  /** The edition's name in its own language and script (`italiano`, `日本語`). */
  autonym: string;
  /** Its English name (`Italian`, `Japanese`). */
  englishName: string;
};

/**
 * How to tell a content article from a project page **on one specific edition**.
 *
 * Both fields are needed and neither substitutes for the other: `Categoria:` is
 * a namespace prefix on it.wikipedia and means nothing on en.wikipedia, while
 * the main page sits in the article namespace on every edition and so is the one
 * non-article page no prefix can catch.
 *
 * Fetched by `client/getSiteNamespaces.ts` from the edition's own `siteinfo`.
 */
export type SiteNamespaces = {
  domain: Domain;
  /**
   * Underscored, colon-terminated prefixes of every namespace that is not the
   * article namespace — each namespace's local name, its canonical English name
   * and its aliases, since a top-read payload can carry any of the three.
   */
  nonArticlePrefixes: string[];
  /** The edition's main page, underscored (`Main_Page`, `Pagina_principale`). */
  mainPageTitle: string;
};

/**
 * The English namespace names, used only when no `SiteNamespaces` is supplied.
 *
 * A fallback, and a knowingly poor one: these are en.wikipedia's names, so on
 * it.wikipedia they catch nothing at all — `Speciale:`, `Portale:` and
 * `Categoria:` pages sail straight through into the market. ADR 0002 requires
 * the real namespace list to come from each edition's own `siteinfo`, which is
 * what {@link SiteNamespaces} carries; this list survives for callers that have
 * no edition context to fetch one with, and every caller that *can* pass one
 * should.
 */
const FALLBACK_EXCLUDED_PREFIXES = [
  "Special:",
  "Wikipedia:",
  "Portal:",
  "Template:",
  "Help:",
  "Category:",
  "File:",
];

const EXCLUDED_EXACT_TITLES = new Set(["Main_Page", "Main Page"]);

export function isContentArticleTitle(
  title: string,
  namespaces?: Pick<SiteNamespaces, "nonArticlePrefixes" | "mainPageTitle">,
): boolean {
  // The pageviews API reports one synthetic row that is not a page at all.
  if (title === "-") {
    return false;
  }

  if (!namespaces) {
    return (
      !EXCLUDED_EXACT_TITLES.has(title) &&
      !FALLBACK_EXCLUDED_PREFIXES.some((prefix) => title.startsWith(prefix))
    );
  }

  if (namespaces.mainPageTitle && title === namespaces.mainPageTitle) {
    return false;
  }
  return !namespaces.nonArticlePrefixes.some((prefix) =>
    title.startsWith(prefix),
  );
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

/**
 * `namespaces` is what makes the content-article filter true of editions other
 * than English. Without it, `it.wikipedia`'s top-read list arrives with
 * `Pagina_principale` at rank 1 — measured at 201,977 views on 2026-08-15, the
 * single most-read "article" in the market — plus its `Speciale:` and `File:`
 * pages, because the fallback list only knows the English names. Optional only so
 * that a caller with no edition context still gets the old behaviour rather than
 * no filtering at all.
 */
export function normalizeTopReadEntries(
  articles: WikimediaTopReadArticle[],
  limit: number,
  domain: Domain = "en",
  namespaces?: Pick<SiteNamespaces, "nonArticlePrefixes" | "mainPageTitle">,
): TopReadEntry[] {
  let filteredRank = 0;

  return articles
    .filter((article) => isContentArticleTitle(article.article, namespaces))
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
