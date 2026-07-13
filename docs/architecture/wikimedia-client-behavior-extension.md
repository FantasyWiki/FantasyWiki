---
title: Wikimedia Client Behavior Extension
type: architecture
tags: [wikimedia, external-apis, how-to]
---

# Wikimedia Client Behavior Extension Guide

This guide shows how to add a new behavior to the shared Wikimedia client without changing existing behavior contracts.

## File roles before adding behavior

- `external-apis/wikimedia/client.ts`: composition root and shared internal helpers.
- `external-apis/wikimedia/client/public-api.ts`: types exposed to app/runtime callers.
- `external-apis/wikimedia/client/wikimedia-wire.ts`: raw Wikimedia payload shapes (internal mapping layer).
- `external-apis/wikimedia/client/<capability>.ts`: one capability module per behavior.

## Example: add `article.searchByPrefix`

### 1) Add raw wire type

In `external-apis/wikimedia/client/wikimedia-wire.ts`:

```ts
export type PrefixSearchResponse = {
  pages: Array<{
    title: string;
    description?: string;
  }>;
};
```

### 2) Add public result type

In `external-apis/wikimedia/client/public-api.ts`:

```ts
export type ArticleSearchResult = {
  title: string;
  description: string;
};
```

### 3) Implement capability module

Create `external-apis/wikimedia/client/searchArticleByPrefix.ts`:

```ts
import type { Domain } from "../../../dto/enums";
import { toWikimediaProjectDomain } from "../../../model/wikimedia";
import type { ArticleSearchResult, WikimediaHttp } from "./public-api";
import type { PrefixSearchResponse } from "./wikimedia-wire";

type Deps = {
  http: WikimediaHttp;
  retryCount: number;
  fetchJsonWithRetry: <T>(
    http: WikimediaHttp,
    url: string,
    retryCount: number,
  ) => Promise<T>;
};

export function createSearchArticleByPrefix(deps: Deps) {
  return async function searchByPrefix(
    domain: Domain,
    prefix: string,
  ): Promise<ArticleSearchResult[]> {
    const projectDomain = toWikimediaProjectDomain(domain);
    const encodedPrefix = encodeURIComponent(prefix);
    const url = `https://${projectDomain}.org/w/rest.php/v1/search/title?q=${encodedPrefix}&limit=10`;

    const response = await deps.fetchJsonWithRetry<PrefixSearchResponse>(
      deps.http,
      url,
      deps.retryCount,
    );

    return response.pages.map((page) => ({
      title: page.title,
      description: page.description ?? "",
    }));
  };
}
```

### 4) Wire it in `createWikimediaClient`

In `external-apis/wikimedia/client.ts`:

```ts
import { createSearchArticleByPrefix } from "./client/searchArticleByPrefix";

const searchByPrefix = createSearchArticleByPrefix({
  http,
  retryCount,
  fetchJsonWithRetry,
});

return {
  pageviews: { getTopReadList },
  article: { getSummary, searchByPrefix },
};
```

## Rules to keep behavior clear

1. Put shared policies in `client.ts`, not in capability modules.
2. Keep raw Wikimedia payloads in `wikimedia-wire.ts`, never in public app types.
3. Keep app-facing results in `public-api.ts`, normalized and stable.
4. Add behavior by composition (new file + wiring), not by modifying existing capability semantics.

## Related

- [Wikimedia Client Architecture](./wikimedia-client-architecture.md)
- [Wikimedia Client Terminology & Hierarchy](./wikimedia-client-terminology-hierarchy.md)
