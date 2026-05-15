import type { WikimediaTopReadArticle } from "../wikimedia";
import {DomainResult, GetViewsByDomainDeps} from "../client/getViewsByDomain";
import {Domain} from "../../../dto/enums";

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
