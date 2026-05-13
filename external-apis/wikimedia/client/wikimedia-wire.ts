import type { WikimediaTopReadArticle } from "../../../model/wikimedia";

/**
 * Raw payload returned by Wikimedia top-read endpoint.
 *
 * This type is intentionally internal: it models upstream response shape
 * before normalization into domain-friendly DTOs.
 */
export type TopReadResponse = {
  items: Array<{
    articles: WikimediaTopReadArticle[];
  }>;
};

/**
 * Raw payload returned by Wikimedia per-article pageviews endpoint.
 */
export type PerArticleResponse = {
  items: Array<{ views: number }>;
};

/**
 * Raw payload returned by Wikimedia page summary endpoint.
 */
export type ArticleSummaryResponse = {
  title?: string;
  extract?: string;
  thumbnail?: {
    source?: string;
  };
};
