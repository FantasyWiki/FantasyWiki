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

**Public API Types**  
`external-apis/wikimedia/client/public-api.ts`, containing stable caller-facing type contracts for the shared client.

**Wire Types**  
`external-apis/wikimedia/client/wikimedia-wire.ts`, containing raw Wikimedia response shapes before normalization.

## Hierarchy for new functionality

When adding new functionality, follow this hierarchy:

1. **Define capability boundary**  
   Decide the namespace and operation name from domain language.
2. **Implement capability module**  
   Add one file under `external-apis/wikimedia/client/` that exports a factory for the new operation.
3. **Reuse shared policies**  
   Inject shared helpers/dependencies from `client.ts`; do not duplicate retry/date/cache logic inside modules.
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
