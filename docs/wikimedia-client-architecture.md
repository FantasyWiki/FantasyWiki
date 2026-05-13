# Wikimedia Client Architecture

This document describes the internal architecture of the shared Wikimedia module at `external-apis/wikimedia/client.ts`.

## Purpose

`external-apis/wikimedia/client.ts` is the composition root for the Wikimedia integration boundary.  
It centralizes shared runtime policy while allowing feature capabilities to evolve in separate modules.

## Architectural shape

The shared client is split into two layers:

1. **Composition root (`client.ts`)**
   - Resolves runtime dependencies (`http`, `fetchFn`, cache, clocks, policy options)
   - Hosts generic internal utilities used across capabilities (date helpers, retryable fetch policy, default cache resolution)
   - Wires capability factories into the exported client surface
2. **Capability modules (`external-apis/wikimedia/client/*.ts`)**
   - Each capability lives in its own file and receives dependencies from the composition root
   - Capability modules contain feature-specific request/response behavior
   - Existing capabilities remain unchanged when new capabilities are added

## Type boundaries

- `external-apis/wikimedia/client/public-api.ts` contains the stable types exposed to callers of the shared client.
- `external-apis/wikimedia/client/wikimedia-wire.ts` contains raw upstream Wikimedia payload shapes used only for mapping/normalization.

This split avoids ambiguity between domain "contracts" and integration-layer types.

## Open/Closed extension model

The module follows Open/Closed by keeping existing capability contracts stable and adding new behavior through new capability files.

Extension workflow:

1. Create a new capability file under `external-apis/wikimedia/client/`
2. Implement the behavior as a factory that accepts shared dependencies
3. Wire it from `createWikimediaClient` in `client.ts` under a new namespace

This keeps `client.ts` open for composition and closed for breaking changes to existing namespaces.

## Shared internal policies in `client.ts`

The composition root enforces the policies that must stay consistent across capabilities:

- **Transport policy**: default `fetch` transport, with optional injected `http` adapter
- **Retry policy**: retries for retryable statuses/network failures via a shared helper
- **Date policy**: UTC-based snapshot/date formatting helpers
- **Cache policy**: optional cache abstraction with browser-safe default cache discovery

## Runtime adapters and ownership

Runtime-specific wrappers (frontend/backend) provide transport adapters and call the same shared client factory.  
Runtime concerns remain outside the shared module so the capability behavior stays deterministic and reusable.

## Related documentation

- For domain language and expansion hierarchy conventions, see `docs/wikimedia-client-terminology-hierarchy.md`.
- For step-by-step behavior extension with a concrete example, see `docs/wikimedia-client-behavior-extension.md`.
