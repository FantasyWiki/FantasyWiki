import type { Domain } from "../../../dto/enums";
import { toWikimediaProjectDomain } from "../../../model/wikimedia";
import type { ArticleSummary, WikimediaHttp } from "./public-api";
import type { ArticleSummaryResponse } from "./wikimedia-wire";

type GetSummaryDependencies = {
  http: WikimediaHttp;
  retryCount: number;
  baseWikipediaUrl: string;
  fetchJsonWithRetry: <T>(
    http: WikimediaHttp,
    url: string,
    retryCount: number,
  ) => Promise<T>;
};

export function createGetSummary(deps: GetSummaryDependencies) {
  return async function getSummary(
    domain: Domain,
    title: string,
  ): Promise<ArticleSummary> {
    const projectDomain = toWikimediaProjectDomain(domain);
    const encodedTitle = encodeURIComponent(title).replace(/%20/g, "_");
    const url = `${deps.baseWikipediaUrl}/page/summary/${encodedTitle}`;

    const response = await deps.fetchJsonWithRetry<ArticleSummaryResponse>(
      {
        get: async <T>(targetUrl: string) => {
          const rewrittenUrl = targetUrl.replace(
            deps.baseWikipediaUrl,
            `https://${projectDomain}.org/api/rest_v1`,
          );
          return deps.http.get<T>(rewrittenUrl);
        },
      },
      url,
      deps.retryCount,
    );

    return {
      title: response.title ?? title,
      extract: response.extract ?? "",
      thumbnailUrl: response.thumbnail?.source,
    };
  };
}
