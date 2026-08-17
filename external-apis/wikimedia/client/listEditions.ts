import type { WikipediaEdition } from "../wikimedia";
import { fetchJsonWithRetry, withCache } from "./internal";
import { CacheLike, WikimediaHttp } from "../client";

/**
 * Raw Sitematrix payload. Every key except `count` and `specials` is a numeric
 * index whose value is one language and its wikis.
 *
 * @see https://www.mediawiki.org/wiki/API:Sitematrix
 */
type SiteMatrixResponse = {
  sitematrix?: Record<
    string,
    | number
    | unknown[]
    | {
        code?: string;
        name?: string;
        localname?: string;
        site?: Array<{ code?: string; closed?: boolean; url?: string }>;
      }
  >;
};

/**
 * Every live Wikipedia language edition, from Wikimedia's own registry.
 *
 * This is what replaces the hand-maintained `Domain = "en" | "it"` union and the
 * `LEAGUE_DOMAINS` constant after it (#531): the set of editions that *exist* is
 * Wikimedia's to state, not ours to keep up to date. Which of them can host a
 * league is a separate and narrower question, answered by pageviews rather than
 * by this list — see `WikipediaEditionScreeningService`.
 *
 * Closed wikis are dropped: Sitematrix still lists them, and a closed edition
 * has no new readership to compete over. Only the `wiki` site of each language
 * is considered — Wiktionary, Wikinews and the rest are different projects with
 * different reading patterns, and the game is about Wikipedia.
 *
 * Cached hard: editions do not appear weekly, and this is the one request whose
 * answer is the same for every player.
 */
export function createListEditions(
  http: WikimediaHttp,
  cache: CacheLike | null,
  retryCount: number,
) {
  return async function listEditions(): Promise<WikipediaEdition[]> {
    const url =
      "https://meta.wikimedia.org/w/api.php?action=sitematrix" +
      "&smtype=language&smsiteprop=url%7Ccode%7Cclosed&smlangprop=code%7Cname%7Clocalname%7Csite" +
      "&format=json&formatversion=2&origin=*";

    return withCache(cache, "wikimedia:sitematrix:wikipedia", async () => {
      const response = await fetchJsonWithRetry<SiteMatrixResponse>(
        http,
        url,
        retryCount,
      );

      const editions: WikipediaEdition[] = [];
      for (const [key, group] of Object.entries(response.sitematrix ?? {})) {
        // `count` is a number and `specials` an array of non-language wikis
        // (commons, meta, …). Neither is a language edition.
        if (key === "count" || key === "specials") continue;
        if (typeof group !== "object" || group === null || Array.isArray(group)) {
          continue;
        }

        const wiki = (group.site ?? []).find(
          (site) => site.code === "wiki" && !site.closed,
        );
        if (!wiki || !group.code) continue;

        editions.push({
          code: group.code,
          // The edition's name in its own language and script — what a player
          // scanning a list of a few dozen editions actually recognises.
          autonym: group.name ?? group.code,
          // And its English name, so the same list can be searched by someone
          // who cannot type the autonym.
          englishName: group.localname ?? group.code,
        });
      }

      return editions;
    });
  };
}
