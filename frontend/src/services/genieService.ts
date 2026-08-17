import { createWikimediaClient } from "@/services/wikimediaClient";
import { fetchMarketArticlesByTitle } from "@/services/marketService";
import type { MarketArticle } from "@/types/market";
import type { Domain } from "../../../dto/enums";
import {
  GENIE_MAX_CANDIDATES,
  type GenieSeedResponse,
} from "../../../dto/genieDTO";
import { toDisplayTitle } from "../../../external-apis/wikimedia/wikimedia";

const client = createWikimediaClient();

/**
 * A real Wikipedia article in the Genie's candidate set, with everything known
 * about how it relates to the anchors — but deliberately *not* its price.
 *
 * Pricing a candidate costs one 365-day pageview request, and the client caches
 * those only as part of a whole search result, not per article. Pricing all ~40
 * up front would mean ~40 requests before the Genie can say its first word, for
 * figures that all but five of them will never show. So the seed ranks on link
 * structure alone and price is resolved at the end, for the survivors only —
 * see `hydrateCandidates`. ADR 0006 ranks by `(mutual links desc, price asc)`;
 * that ordering is applied there, where price exists.
 */
export interface GenieCandidate {
  /** Small integer, assigned here. What the model answers in. */
  id: number;
  canonicalTitle: string;
  title: string;
  description?: string;
  /**
   * How many anchors this article links *and* is linked back by — a mutual
   * link is an EXCELLENT Chemistry Link, one direction alone is GOOD.
   */
  mutualAnchors: number;
  /** How many anchors it has any link relation with, in either direction. */
  connectedAnchors: number;
}

/**
 * `linksto:Formula One` silently parses as `linksto:Formula` plus the free text
 * "One" and returns unrelated articles. Underscoring is enforced here as well as
 * in the prompt: a prompt is a request, and this failure is silent.
 */
function anchorTerm(anchor: string): string {
  return anchor.trim().replace(/\s+/g, "_");
}

/** Mirrors `normKey`/`chemistryKey`: the same fold used everywhere titles meet. */
function foldTitle(title: string): string {
  return title.trim().toLowerCase().replace(/[ _]+/g, "_");
}

interface SeedHit {
  canonicalTitle: string;
  title: string;
  description?: string;
  rank: number;
  /** Links *to* every anchor — it came from the `linksto:` search. */
  linksToAnchors: boolean;
}

async function searchHits(
  domain: Domain,
  query: string,
  linksToAnchors: boolean
): Promise<SeedHit[]> {
  if (!query.trim()) return [];
  try {
    const hits = await client.article.searchTitles(
      domain,
      query,
      GENIE_MAX_CANDIDATES
    );
    return hits.map((hit, index) => ({
      canonicalTitle: hit.canonicalTitle,
      title: hit.displayTitle,
      description: hit.description,
      rank: index,
      linksToAnchors,
    }));
  } catch {
    // One search failing must not end the session: the other seeds still run,
    // and a thin candidate set is a worse Genie, not a broken one.
    return [];
  }
}

/**
 * Titles each anchor links *out* to. Fetched per anchor and cached for 7 days
 * by the client, so a repeat hunt over the same anchors costs nothing.
 *
 * Keyed by the fold so it can be intersected and matched against search hits,
 * but the *original* title is the value — the fold lowercases, and a lowercased
 * title is not an article. Pageview lookups on `vasco_da_gama` 404, which
 * `getArticleViews` swallows into undefined views, which prices the row at zero
 * with blank stats and no error anywhere. That would hit exactly the cheap,
 * well-connected finds this seed exists to surface.
 */
async function outboundSets(
  domain: Domain,
  anchors: string[]
): Promise<Map<string, string>[]> {
  return Promise.all(
    anchors.map(async (anchor) => {
      try {
        const result = await client.article.getLinkedArticles(domain, anchor);
        return new Map(
          result.linkedArticles.map((title) => [foldTitle(title), title])
        );
      } catch {
        return new Map<string, string>();
      }
    })
  );
}

/**
 * Builds the candidate set from a parsed query.
 *
 * Both seeds always run and are merged — there is no routing decision to get
 * wrong. Reading *"the Portuguese explorer who reached India"* as an anchor
 * query would, under routing, drop Vasco da Gama entirely and leave the player
 * looking at a Genie that simply failed; merged, a misparse can only add
 * surplus candidates, which is exactly what the narrowing loop is for.
 *
 * Nothing here is written for a pair of anchors: the `linksto:` terms are
 * conjoined and the outbound sets are intersected over however many there are.
 */
export async function seedCandidates(
  domain: Domain,
  seed: GenieSeedResponse
): Promise<GenieCandidate[]> {
  const anchors = seed.anchors.filter((anchor) => anchor.trim().length > 0);

  const anchorQuery = anchors.map((a) => `linksto:${anchorTerm(a)}`).join(" ");

  const [keywordHits, anchorHits, outbound] = await Promise.all([
    searchHits(domain, seed.keywords, false),
    anchors.length ? searchHits(domain, anchorQuery, true) : [],
    outboundSets(domain, anchors),
  ]);

  // Articles every anchor links out to. Mostly citation-identifier redirects
  // and other boilerplate, and deliberately kept anyway: they are cheap, they
  // still carry chemistry, and discarding them as noise would remove the most
  // efficient plays in the game. The narrowing loop strips what is truly
  // useless.
  const intersection = outbound.length
    ? [...outbound[0].entries()].filter(([key]) =>
        outbound.every((set) => set.has(key))
      )
    : [];

  const merged = new Map<string, SeedHit>();
  for (const hit of [...anchorHits, ...keywordHits]) {
    const key = foldTitle(hit.canonicalTitle);
    const existing = merged.get(key);
    if (existing) {
      // A candidate found by both seeds keeps the stronger fact about itself.
      existing.linksToAnchors ||= hit.linksToAnchors;
      existing.description ??= hit.description;
    } else {
      merged.set(key, { ...hit });
    }
  }

  for (const [key, originalTitle] of intersection) {
    if (merged.has(key)) continue;
    merged.set(key, {
      // The link list gives the title as written — correctly cased. Underscore
      // it into a canonical title rather than reusing the lowercased fold.
      canonicalTitle: originalTitle.trim().replace(/\s+/g, "_"),
      title: toDisplayTitle(originalTitle),
      // The link list carries no blurb. The model is told to judge from title
      // and description, so these are weaker candidates on purpose — they earn
      // their place through chemistry, which is ranked below.
      description: undefined,
      rank: Number.MAX_SAFE_INTEGER,
      linksToAnchors: false,
    });
  }

  const scored = [...merged.entries()].map(([key, hit]) => {
    const linkedBy = outbound.filter((set) => set.has(key)).length;
    return {
      hit,
      // Mutual means both directions: the article links to the anchors *and*
      // the anchor links back. ADR 0006 measured that no candidate manages this
      // with two unrelated anchors, so in practice this separates the rare
      // strong find from the merely connected.
      mutualAnchors: hit.linksToAnchors ? linkedBy : 0,
      connectedAnchors: hit.linksToAnchors
        ? Math.max(anchors.length, linkedBy)
        : linkedBy,
    };
  });

  scored.sort(
    (a, b) =>
      b.mutualAnchors - a.mutualAnchors ||
      b.connectedAnchors - a.connectedAnchors ||
      a.hit.rank - b.hit.rank
  );

  return scored
    .slice(0, GENIE_MAX_CANDIDATES)
    .map(({ hit, mutualAnchors, connectedAnchors }, index) => ({
      id: index,
      canonicalTitle: hit.canonicalTitle,
      title: hit.title,
      description: hit.description,
      mutualAnchors,
      connectedAnchors,
    }));
}

/**
 * Turns the survivors into ordinary market rows: real prices, real ownership,
 * the normal buy flow. This is the only point at which the Genie costs a
 * pageview request per article, and by then there are at most a handful.
 *
 * Ordered as ADR 0006 specifies — mutual links first, price second — so the
 * cheap, well-connected find sits above the expensive obvious one. *Artificial
 * intelligence arms race* carries the same chemistry as *Google* at 1/200th the
 * traffic, and this is what surfaces it.
 */
export async function hydrateCandidates(
  domain: Domain,
  languageScale: number,
  candidates: GenieCandidate[]
): Promise<MarketArticle[]> {
  const articles = await fetchMarketArticlesByTitle(
    domain,
    languageScale,
    candidates.map((candidate) => ({
      title: candidate.canonicalTitle,
      // ContractPrice genuinely floors at 0 below ~2,000 views (ADR 0003/0005),
      // so an article with no view series is free rather than unpriced — there
      // is no stale figure to fall back to here, and none is needed.
      fallbackPrice: 0,
    }))
  );

  const chemistryByKey = new Map(
    candidates.map((candidate) => [
      foldTitle(candidate.canonicalTitle),
      candidate,
    ])
  );

  return [...articles].sort((a, b) => {
    const aChem = chemistryByKey.get(foldTitle(a.title))?.mutualAnchors ?? 0;
    const bChem = chemistryByKey.get(foldTitle(b.title))?.mutualAnchors ?? 0;
    return bChem - aChem || a.price - b.price;
  });
}
