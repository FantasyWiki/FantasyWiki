---
title: Wikimedia Client Terminology & Hierarchy
type: architecture
tags: [wikimedia, external-apis, terminology]
---

# Wikimedia Client Terminology and Hierarchy

This document defines terminology and hierarchy rules used when expanding the shared Wikimedia client.

## Terminology

**Composition Root**
`external-apis/wikimedia/client.ts`, responsible for dependency resolution and capability wiring.

**Capability Module**
A single file under `external-apis/wikimedia/client/` that implements one client capability via factory function.

**Capability Namespace**
A top-level section in the returned client object (`client.<namespace>.<operation>`), used to group related operations.

**Client Types**
`external-apis/wikimedia/client.ts`, declaring what a caller binds to: `WikimediaClient`,
`WikimediaHttp`, `CacheLike`.

**Data Types**
`external-apis/wikimedia/wikimedia.ts`, holding the normalized shapes a caller receives, the raw
upstream shapes they are mapped from, and the normalizers between them.

**Shared Internals**
`external-apis/wikimedia/client/internal.ts`, holding the policies every capability applies
identically, retry, concurrency, UTC dates, cache access.

## Hierarchy for new functionality

When adding new functionality, follow this hierarchy:

1. **Define capability boundary**
   Decide the namespace and operation name from domain language.
2. **Implement capability module**
   Add one file under `external-apis/wikimedia/client/` that exports a factory for the new operation.
3. **Reuse shared policies**
   Import the helpers from `client/internal.ts` and take the cache and transport from the
   composition root; never re-implement retry, concurrency, date or cache logic in a capability.
4. **Expose via composition root**
   Wire the new factory into `createWikimediaClient` under the chosen namespace.
5. **Keep wrappers thin**
   Frontend/backend wrappers should continue to only provide adapters/options and defer behavior to the shared module.

## Naming guidance

- Use verb-driven operation names (`get`, `list`, `search`, `resolve`) for public capability methods.
- Use noun-driven namespace names for cohesive capability groups.
- Keep internal helper names policy-oriented (`fetchJsonWithRetry`, `toDateParts`, `getDefaultCache`) instead of endpoint-specific wording.

## Related

- [Wikimedia Client Architecture](./wikimedia-client-architecture.md)
- [Wikimedia Client Behavior Extension](./wikimedia-client-behavior-extension.md)
