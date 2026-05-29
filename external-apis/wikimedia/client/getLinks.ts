import type { Domain } from "../../../dto/enums";
import { WikimediaHttp } from "../client";
import {fetchJsonWithRetry} from "./internal";
import {ArticleSummaryResponse} from "./getSummary";

type LinksResponse = {
    continue?: {
        plcontinue?: string;
        continue?: string;
    };
    query?: {
        pages?: Array<{
            pageid: number;
            ns: number;
            title: string;
            links?: Array<{ ns: number; title: string }>;
        }>;
    };
};

function buildActionApiBase(domain: Domain): string {
    return `https://${domain}.wikipedia.org/w/api.php`;
}

/**
 * Creates a function that fetches all internal linked article titles
 * from a given page using the MediaWiki Action API (action=query&prop=links).
 *
 * Usage:
 *   const getLinkedArticles = createGetLinks({ http });
 *   const linkedArticles = await getLinkedArticles("en", "Albert Einstein");
 */
export function createGetLinks(http: WikimediaHttp, retryCount: number) {

    return async function getLinkedArticles(
        domain: Domain,
        title: string,
    ): Promise<string[]> {
        const baseUrl = buildActionApiBase(domain);
        const linkedArticles: string[] = [];
        let plcontinue: string | undefined;

        try {
        do {
            const params = new URLSearchParams({
                action: "query",
                titles: title,
                prop: "links",
                pllimit: "max",
                format: "json",
                formatversion: "2",
            });

            if (plcontinue) {
                params.set("plcontinue", plcontinue);
            }

            const url = `${baseUrl}?${params.toString()}`;
            const response = await fetchJsonWithRetry<LinksResponse>(
                http,
                url,
                retryCount,
            );

            const pages = response.query?.pages ?? [];
            const page = pages[0];

            if (page?.links?.length) {
                for (const link of page.links) {
                    linkedArticles.push(link.title);
                }
            }

            plcontinue = response.continue?.plcontinue;
        } while (plcontinue);
    } catch (error) {
        throw new Error(`Failed to fetch linked articles for ${title}: ${String(error)}`);
    }

        return linkedArticles;
    };
}