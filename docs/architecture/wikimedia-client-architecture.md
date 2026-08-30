---
title: Wikimedia Client Architecture
type: architecture
tags: [wikimedia, external-apis, composition-root]
---

# Wikimedia Client Architecture

This document describes the internal architecture of the shared Wikimedia module at `external-apis/wikimedia/client.ts`.

## Purpose

`external-apis/wikimedia/client.ts` is the composition root for the Wikimedia integration boundary.  
It centralizes shared runtime policy while allowing feature capabilities to evolve in separate modules.

## Architectural shape

The shared client is split into two layers:

1. **Composition root (`client.ts`)**
   - Resolves runtime dependencies (`http`, `fetchFn`, cache, policy options)
   - Owns cache policy: `getDefaultCache` discovers a browser-safe store, and
     `setTtl` hands each capability the same cache at the lifetime that
     capability's data deserves
   - Wires capability factories into the exported client surface
2. **Capability modules (`external-apis/wikimedia/client/*.ts`)**
   - Each capability lives in its own file and receives dependencies from the composition root
   - Capability modules contain feature-specific request/response behavior
   - Existing capabilities remain unchanged when new capabilities are added
3. **Shared internals (`client/internal.ts`)**
   - The policies every capability must apply identically — retryable fetch,
     UTC date formatting, the concurrency cap, the cache read/write wrapper —
     imported by the capability modules rather than passed to them

## Type boundaries

- `external-apis/wikimedia/client.ts` declares the types a **caller** binds to:
  `WikimediaClient` (the namespaces), `WikimediaHttp` (the transport seam) and
  `CacheLike`.
- `external-apis/wikimedia/wikimedia.ts` holds the **data** types either side
  speaks — the normalized ones a caller receives (`TopReadEntry`,
  `ArticleSearchHit`, `WikipediaEdition`, `SiteNamespaces`), the raw upstream
  shapes they are mapped from (`WikimediaTopReadArticle`), and the normalizers
  that cross between them (`normalizeTopReadEntries`, `isContentArticleTitle`,
  `toDisplayTitle`).
- A response shape used by **one** capability stays private to that capability's
  file (`TopReadResponse` in `getTopReadList.ts`, `SearchResponse` in
  `searchArticles.ts`). It is promoted to `wikimedia.ts` only when a second
  module needs it.

The boundary that matters is therefore not raw-versus-public in separate files —
it is that a raw shape never leaves the module that maps it, and that every
caller-facing type is normalized.

## Open/Closed extension model

The module follows Open/Closed by keeping existing capability contracts stable and adding new behavior through new capability files.

Extension workflow:

1. Create a new capability file under `external-apis/wikimedia/client/`
2. Implement the behavior as a factory that accepts shared dependencies
3. Wire it from `createWikimediaClient` in `client.ts` under a new namespace

This keeps `client.ts` open for composition and closed for breaking changes to existing namespaces.

## Shared internal policies

Split across two files, by who has to decide them:

| policy | where | what it fixes |
| --- | --- | --- |
| Transport | `client.ts` | default `fetch`, or an injected `http` adapter |
| Cache lifetime | `client.ts` | `getDefaultCache` + a `setTtl` per capability |
| Retry | `client/internal.ts` | `fetchJsonWithRetry` — retryable statuses and network failures |
| Concurrency | `client/internal.ts` | `MAX_CONCURRENT_REQUESTS` = 3, applied through `mapWithLimit` |
| Dates | `client/internal.ts` | UTC snapshot formatting (`toYmd`, `shiftUtcDays`, `toDateParts`) |
| Cache read/write | `client/internal.ts` | `withCache`, so a capability never touches the store directly |

A capability that reimplements any of these is the failure this split exists to
prevent: the concurrency cap in particular is what keeps the client inside
Wikimedia's rate guidance, and it only works if every fan-out goes through the
one helper.

## Runtime adapters and ownership

Runtime-specific wrappers (frontend/backend) provide transport adapters and call the same shared client factory.  
Runtime concerns remain outside the shared module so the capability behavior stays deterministic and reusable.

## Related

- [Wikimedia Client Terminology & Hierarchy](./wikimedia-client-terminology-hierarchy.md) — domain language and expansion hierarchy conventions.
- [Wikimedia Client Behavior Extension](./wikimedia-client-behavior-extension.md) — step-by-step, with a concrete example.
- [Backend Architecture](./backend-architecture.md) — where the client is consumed.
- [Market List](./market-list.md) — the client's largest consumer, and what it does with a snapshot.
