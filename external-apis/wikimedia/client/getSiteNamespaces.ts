import type { Domain } from "../../../model/enums";
import type { SiteNamespaces } from "../wikimedia";
import { fetchJsonWithRetry, withCache } from "./internal";
import { CacheLike, WikimediaHttp } from "../client";

/** Raw `action=query&meta=siteinfo` payload (formatversion=2). */
type SiteInfoResponse = {
  query?: {
    general?: { mainpage?: string };
    namespaces?: Record<
      string,
      { id: number; name?: string; canonical?: string }
    >;
    namespacealiases?: Array<{ id: number; alias: string }>;
  };
};

/**
 * An edition's namespace list, from the edition itself.
 *
 * ADR 0002 is explicit that this must come from each domain's own `siteinfo`
 * rather than a hardcoded prefix list, and the reason is visible in the list it
 * replaces: `isContentArticleTitle` in `wikimedia.ts` filters `Special:`,
 * `Wikipedia:`, `Portal:`, `Category:`… — the English names, which catch nothing
 * on it.wikipedia, where the same pages are `Speciale:`, `Wikipedia:`,
 * `Portale:` and `Categoria:`. A hardcoded list generalises only to the
 * languages somebody remembered to add prefixes for, and opening the edition
 * picker (#531) turns that from two editions into a few hundred.
 *
 * Cached hard where a cache exists: namespaces are part of an edition's
 * configuration and change on the order of never.
 */
export function createGetSiteNamespaces(
  http: WikimediaHttp,
  cache: CacheLike | null,
  retryCount: number,
) {
  return async function getSiteNamespaces(
    domain: Domain,
  ): Promise<SiteNamespaces> {
    const url =
      `https://${domain}.wikipedia.org/w/api.php` +
      `?action=query&meta=siteinfo&siprop=namespaces%7Cnamespacealiases%7Cgeneral` +
      `&format=json&formatversion=2&origin=*`;

    return withCache(cache, `wikimedia:siteinfo:${domain}.wikipedia`, async () => {
      const response = await fetchJsonWithRetry<SiteInfoResponse>(
        http,
        url,
        retryCount,
      );

      const prefixes = new Set<string>();
      const add = (name: string | undefined) => {
        // Titles arrive underscored from the pageviews API; namespace names come
        // back spaced ("Wikipedia talk"), so they are normalised to match.
        if (name) prefixes.add(`${name.replace(/ /g, "_")}:`);
      };

      for (const namespace of Object.values(response.query?.namespaces ?? {})) {
        if (namespace.id === 0) continue; // the article namespace itself
        add(namespace.name);
        add(namespace.canonical);
      }
      for (const alias of response.query?.namespacealiases ?? []) {
        if (alias.id !== 0) add(alias.alias);
      }

      return {
        domain,
        nonArticlePrefixes: [...prefixes],
        mainPageTitle: (response.query?.general?.mainpage ?? "").replace(
          / /g,
          "_",
        ),
      };
    });
  };
}
