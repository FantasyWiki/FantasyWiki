import type { Domain } from "../../../dto/enums";
import type { TopReadEntry } from "../../../model/wikimedia";

/**
 * Minimal cache interface used by the shared client.
 *
 * Implementations can be browser `localStorage`, in-memory test doubles,
 * or any runtime-specific storage exposing these methods.
 */
export type CacheLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Transport adapter contract consumed by the shared client.
 *
 * Wrappers can provide Axios/fetch/other adapters as long as they return
 * status + parsed data in this shape.
 */
export type WikimediaHttp = {
  get<T>(url: string): Promise<{ status: number; data: T }>;
};

/**
 * Normalized result returned by `pageviews.getTopReadList`.
 */
export type TopReadListResult = {
  projectDomain: string;
  snapshotDate: string;
  filteredSnapshotVolume: number;
  entries: TopReadEntry[];
};

/**
 * Normalized article summary returned by `article.getSummary`.
 */
export type ArticleSummary = {
  title: string;
  extract: string;
  thumbnailUrl?: string;
};

/**
 * Optional runtime and policy overrides for `createWikimediaClient`.
 */
export type WikimediaClientOptions = {
  http?: WikimediaHttp;
  fetchFn?: typeof fetch;
  now?: () => Date;
  cache?: CacheLike | null;
  maxFallbackDays?: number;
  retryCount?: number;
  averageDays?: number;
};

/**
 * Public client API exposed to application code.
 */
export type WikimediaClient = {
  pageviews: {
    getTopReadList(domain: Domain, limit: number): Promise<TopReadListResult>;
  };
  article: {
    getSummary(domain: Domain, title: string): Promise<ArticleSummary>;
  };
};
