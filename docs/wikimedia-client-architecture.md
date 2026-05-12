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

## What this feature does

The shared Wikimedia module fetches a **Top Read Snapshot**, filters and normalizes it into domain-safe entries, computes **Filtered Snapshot Volume**, and enriches each entry with a 30-day average pageview value when available.

It also applies resilience policies consistently:

- Snapshot fallback across recent UTC days (`maxFallbackDays`)
- Retry for transient failures (`retryCount`, 429/5xx)
- Best-effort cache (cache read/parse/write failures must not break the main flow)

## Atomic notes: article-detail data contract

This section documents the data boundaries used by article detail behavior.

### Source-of-truth split

- **External Wikimedia data (non-persisted)**:
  - Article summary (`title`, `extract`, optional `thumbnailUrl`) is loaded from Wikimedia on demand through the shared client API:
    - `external-apis/wikimedia/client.ts` → `article.getSummary(domain, title)`
- **Persisted game/domain data**:
  - Contract ownership, price, expiry, and team context come from backend game APIs (`/api/*`), not Wikimedia.

### Runtime/mock policy

- Runtime mock mode must not replace Wikimedia summary responses.
- Wikimedia behavior may be stubbed only in tests at the service/composable boundary for determinism.

### Ownership contract boundary

- Ownership evaluation is team-based:
  - **Owner Team**: contract owner team id from contract payload.
  - **Viewer Team Context**: active team id for selected league from `/api/leagues/:leagueId/team`.
- Client ownership logic must compare team ids, never player ids or session subject ids.

### Change points for data behavior

- To change summary mapping/fallback policy:
  - edit `external-apis/wikimedia/client.ts` (`ArticleSummaryResponse` mapping and `article.getSummary`).
- To change summary loading/caching semantics in frontend:
  - edit `frontend/src/composables/useArticleSummary.ts` (`summaryCache`, fetch trigger, error behavior).
- To change ownership context acquisition:
  - edit `frontend/src/stores/league.ts` (`fetchCurrentTeamContext`, `currentTeamId`, loading/error states).

## Where Axios is used

Axios is used only inside runtime wrappers:

- `frontend/src/services/wikimediaClient.ts`
- `backend/src/services/wikimediaClient.ts`

Each wrapper builds an Axios-backed `http` adapter (`createAxiosHttp`) and passes it to `external-apis/wikimedia/client.ts`.

The external API module itself is transport-agnostic and does not depend on Axios directly.

## How to use it

### Frontend

```ts
import { createWikimediaClient } from "@/services/wikimediaClient";

const client = createWikimediaClient();
const result = await client.pageviews.getTopReadList("en", 5);
```

### Backend

```ts
import { createWikimediaClient } from "../services/wikimediaClient";

const client = createWikimediaClient();
const result = await client.pageviews.getTopReadList("it", 5);
```

### Return shape

`getTopReadList(domain, limit)` returns:

- `projectDomain`
- `snapshotDate`
- `filteredSnapshotVolume`
- `entries` (normalized list with display title, filtered/source rank, daily views, article URL, and optional `averageViews30d`)

## How to expand it safely

1. Add new behavior in `external-apis/wikimedia/client.ts` first; keep wrappers thin.
2. Preserve the public API unless a deliberate breaking change is approved.
3. If a new runtime needs custom transport, pass a custom `http` implementation via `WikimediaClientOptions`.
4. If new caching behavior is needed, inject a `cache` implementation rather than hardcoding runtime storage.
5. Reuse fixtures in `external-apis/wikimedia/test-utils/fixtures.ts` for deterministic tests.
6. Keep domain semantics aligned with `CONTEXT.md` (snapshot date, filtered rank, filtered snapshot volume).

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
