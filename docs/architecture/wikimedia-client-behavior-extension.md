---
title: Wikimedia Client Behavior Extension
type: architecture
tags: [wikimedia, external-apis, how-to]
---

# Wikimedia Client Behavior Extension Guide

This guide shows how to add a new behavior to the shared Wikimedia client without changing existing behavior contracts.

## File roles before adding behavior

- `external-apis/wikimedia/client.ts`: composition root, transport and cache policy, and the
  types a caller binds to (`WikimediaClient`, `WikimediaHttp`, `CacheLike`).
- `external-apis/wikimedia/client/internal.ts`: the shared policies: `fetchJsonWithRetry`,
  `withCache`, `mapWithLimit`, `MAX_CONCURRENT_REQUESTS`, the UTC date helpers, `wikipediaRestUrl`.
- `external-apis/wikimedia/wikimedia.ts`: data types more than one module speaks, and the
  normalizers between raw and normalized.
- `external-apis/wikimedia/client/<capability>.ts`: one capability module per behavior, holding
  its own raw response type and its own normalized result type until a second module needs them.

## Example: add `article.searchByPrefix`

### 1) Write the capability module

Create `external-apis/wikimedia/client/searchArticleByPrefix.ts`. Both types stay here, the raw
shape because nothing else maps it, the result because nothing else returns it:

```ts
import type { Domain } from "../../../model/enums";
import { fetchJsonWithRetry, withCache, wikipediaRestUrl } from "./internal";
import type { CacheLike, WikimediaHttp } from "../client";

/** Raw payload from the REST title-search endpoint. */
type PrefixSearchResponse = {
  pages: Array<{ title: string; description?: string }>;
};

/** Normalized result returned by `article.searchByPrefix`. */
export type ArticleSearchResult = {
  title: string;
  description: string;
};

export function createSearchArticleByPrefix(
  http: WikimediaHttp,
  cache: CacheLike | null,
  retryCount: number) {
  return async function searchByPrefix(
    domain: Domain,
    prefix: string): Promise<ArticleSearchResult[]> {
    const encoded = encodeURIComponent(prefix);
    const url = wikipediaRestUrl(domain, `/search/title?q=${encoded}&limit=10`);
    const cacheKey = `wikimedia:prefix:${domain}.wikipedia:${encoded}`;

    return withCache(cache, cacheKey, async () => {
      const response = await fetchJsonWithRetry<PrefixSearchResponse>(
        http,
        url,
        retryCount);
      return response.pages.map((page) => ({
        title: page.title,
        description: page.description ?? "",
      }));
    });
  };
}
```

Dependencies arrive as **positional arguments in the order every other capability takes them**
(`http`, `cache`, `retryCount`, then anything capability-specific), not as an options object. The
helpers are imported, not injected: they are policy, and a capability that could be handed a
different retry is a capability that can quietly have one.

### 2) Wire it in `createWikimediaClient`

In `external-apis/wikimedia/client.ts`, inside the returned object, choosing the cache lifetime
that suits the data:

```ts
import { createSearchArticleByPrefix } from "./client/searchArticleByPrefix";

  article: {
    getSummary: createGetSummary(http, setTtl(cache, 7 * DAY), retryCount),
    // …existing operations unchanged…
    searchByPrefix: createSearchArticleByPrefix(http, setTtl(cache, 7 * DAY), retryCount),
  },
```

The TTL is the composition root's call, not the capability's: it is the one place that can see
every capability's lifetime next to the others, a day's top-read list is immutable and takes no
TTL at all, a namespace list gets 30 days, a search gets 7.

### 3) Extend the client type

Add the operation to the `article` namespace on `WikimediaClient` in `client.ts`. Adding an
operation is additive for every existing caller; changing one is not.

## Rules to keep behavior clear

1. Take transport and cache from the composition root; import retry, concurrency, date and cache
   helpers from `client/internal.ts`. Never re-implement one inside a capability.
2. Keep a raw Wikimedia payload inside the module that maps it, and never return one.
3. Promote a type to `wikimedia.ts` only when a second module needs it.
4. Fan out through `mapWithLimit` at `MAX_CONCURRENT_REQUESTS`; a bare `Promise.all` over a list
   of titles is how the client stops being a well-behaved Wikimedia consumer.
5. Add behavior by composition (new file + wiring), not by modifying existing capability semantics.

## Related

- [Wikimedia Client Architecture](./wikimedia-client-architecture.md)
- [Wikimedia Client Terminology & Hierarchy](./wikimedia-client-terminology-hierarchy.md)
