import type { WikimediaTopReadArticle } from "../wikimedia";
import {DomainResult} from "../client/getViewsByDomain";
import {Domain} from "../../../model/enums";

export const defaultTopReadArticles: WikimediaTopReadArticle[] = [
  { article: "Main_Page", views: 5000, rank: 1 },
  { article: "Special:Search", views: 4500, rank: 2 },
  { article: "ChatGPT", views: 3000, rank: 3 },
  { article: "Pope_Francis", views: 2500, rank: 4 },
  { article: "A_Minecraft_Movie", views: 2000, rank: 5 },
  { article: "Donald_Trump", views: 1800, rank: 6 },
  { article: "The_Last_of_Us_(TV_series)", views: 1600, rank: 7 },
  { article: "Taylor_Swift", views: 1200000, rank: 8 },
];

export const defaultViewsByDomainResult: DomainResult = {
    domain: "en",
    snapshotDate: "2026-04-27",
    views: 123456789,
};

export const defaultPerArticleViews: Record<string, number[]> = {
  ChatGPT: [1000, 2000],
  Pope_Francis: [1400, 1600],
  A_Minecraft_Movie: [1300, 1700],
  Donald_Trump: [900, 1100],
  "The_Last_of_Us_(TV_series)": [1200, 1800],
  Taylor_Swift: [1100, 1900],
};

type TopReadResponseOptions = {
  project?: string;
  year?: string;
  month?: string;
  day?: string;
  articles?: WikimediaTopReadArticle[];
};

type ViewsByDomainOptions = {
    domain?: Domain;
    year?: string;
    month?: string;
    day?: string;
    result?: DomainResult;
};

export function buildTopReadResponse(options: TopReadResponseOptions): {
  items: Array<{
    project: string;
    access: string;
    year: string;
    month: string;
    day: string;
    articles: WikimediaTopReadArticle[];
  }>;
} {
  return {
    items: [
      {
        project: options.project ?? "en.wikipedia",
        access: "all-access",
        year: options.year ?? "2026",
        month: options.month ?? "04",
        day: options.day ?? "27",
        articles: options.articles ?? defaultTopReadArticles,
      },
    ],
  };
}

export function buildViewByDomainResponse(options: ViewsByDomainOptions): ViewsByDomainOptions{
    return {
                domain: options.domain ?? "en",
                year: options.year ?? "2026",
                month: options.month ?? "04",
                day: options.day ?? "27",
                result: options.result ?? defaultViewsByDomainResult,
            }
}

export function buildPerArticleViewsResponse(views: number[]): {
  items: Array<{ views: number }>;
} {
  return {
    items: views.map((value) => ({ views: value })),
  };
}

/**
 * An edition's `siteinfo` namespace payload, as `getTopReadList` fetches it to
 * filter project pages out of a market (ADR 0002). Defaults to en.wikipedia's
 * names; pass `mainpage`/`namespaces` for another edition.
 */
export function buildSiteInfoResponse(options: {
  mainpage?: string;
  namespaces?: Record<string, { id: number; name?: string; canonical?: string }>;
} = {}) {
  return {
    query: {
      general: { mainpage: options.mainpage ?? "Main Page" },
      namespaces:
        options.namespaces ?? {
          "0": { id: 0, name: "", canonical: "" },
          "-1": { id: -1, name: "Special", canonical: "Special" },
          "4": { id: 4, name: "Wikipedia", canonical: "Project" },
          "14": { id: 14, name: "Category", canonical: "Category" },
        },
      namespacealiases: [],
    },
  };
}

/**
 * Builds a `fetch` double that answers by **URL** rather than by call order.
 *
 * `getTopReadList` makes three kinds of request — the edition's siteinfo, the
 * day's top-read list, and one view series per entry — and the order between them
 * is an implementation detail. A `mockResolvedValueOnce` chain encodes that order
 * as if it were a contract, so adding a request silently hands one stub's body to
 * another's caller and the test fails somewhere unrelated. Routing on the URL is
 * what keeps these specs about behaviour.
 *
 * Each route returns a fresh `Response` per call, because a `Response` body can
 * only be read once.
 */
export function buildRoutedFetch(routes: {
  siteinfo?: () => Response;
  topRead?: () => Response;
  perArticle?: () => Response;
  fallback?: () => Response;
}): (input: RequestInfo | URL) => Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  return async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("meta=siteinfo")) {
      return (routes.siteinfo ?? (() => json(buildSiteInfoResponse())))();
    }
    if (url.includes("/metrics/pageviews/top/")) {
      return (routes.topRead ?? (() => json(buildTopReadResponse({}))))();
    }
    if (url.includes("/metrics/pageviews/per-article/")) {
      return (
        routes.perArticle ??
        (() => json(buildPerArticleViewsResponse([10, 20])))
      )();
    }
    return (routes.fallback ?? (() => json({})))();
  };
}
