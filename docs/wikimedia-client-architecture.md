# Wikimedia Client Architecture

This document defines how FantasyWiki centralizes Wikimedia integration behavior without requiring a single runtime owner.

## Decision

FantasyWiki centralizes the **Wikimedia Client** as a shared cross-runtime policy contract used by both frontend and backend.

Centralization here means shared behavior, not single traffic ownership.

## Canonical interpretation

- **Centralized**: one shared policy contract for Wikimedia access (request semantics, retries/backoff, cache abstraction, normalization, and telemetry hooks).
- **Distributed callers**: frontend and backend may both call Wikimedia using that same contract.
- **Transport baseline**: native `fetch` is the default transport.
- **Axios role**: Axios is optional and treated as an adapter, not the canonical transport.

## Shared policy requirements

- Public API remains high-level and stable (`pageviews.getTopReadList(domain, limit)`).
- Transport is injected so tests can run with fake HTTP without live Wikimedia calls.
- Retry/backoff policy is explicit and shared (429/5xx retry with capped backoff and jitter).
- Cache is runtime-injected via interface (no hard dependency on browser `localStorage`).
- Observability is runtime-agnostic through hooks (`request_start`, `request_success`, `request_failure`, `cache_hit`, `cache_miss`).
- Domain normalization remains consistent with shared model artifacts.

## Runtime responsibilities

- Frontend and backend can each provide transport, cache, and telemetry implementations suitable for their environment.
- Runtime-specific concerns (browser storage constraints, worker limits, deployment config) must not change shared policy semantics.
- Frontend may call Wikimedia directly for presentation-only use cases.
- Backend adopts the same shared client immediately as an internal module, even before exposing Wikimedia-backed endpoints.

## Non-goals

- This decision does not force all Wikimedia traffic through backend.
- This decision does not mandate Axios as the primary transport.
- This decision does not move domain terminology into implementation-specific code.

## Migration direction

- Replace the current frontend-only Wikimedia service with a shared root integration module.
- Keep frontend and backend wrappers thin: each runtime only provides transport/cache/telemetry adapters.
- Preserve existing domain output semantics during migration (`Top Read List`, `Filtered Snapshot Volume`, rank semantics, and snapshot-date rules).
- Frontend remains direct-to-Wikimedia for current landing presentation paths.
- Backend integration is required now at module level (internal use + tests), with endpoint exposure deferred until a backend product use case appears.

## Approved implementation sequence (TDD)

1. Shared module extraction tracer bullet with the canonical positional API.
2. Cache safety behaviors (`localStorage` access, cache parse failures, cache write failures).
3. Explicit loading/ready/error UI state in leaderboard (unavailable message only on error).
4. Formatting fixes (compact volume label; `Avg: N/A` without `/day` when average is unavailable).
5. Fixture and mock fidelity updates (shared fixture builders and request-date echo in MSW).
6. Deterministic async test waits (replace `setTimeout(..., 0)` waits).
