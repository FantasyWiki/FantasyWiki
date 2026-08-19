---
title: Backend Architecture
type: architecture
tags: [backend, hono, cloudflare, layering]
---

# FantasyWiki Backend Architecture

## Overview

The backend is a Cloudflare Worker built with Hono. It follows a layered structure:

1. **Routes**: HTTP handling (`backend/src/routes`)
2. **Services**: business workflows (`backend/src/services`)
3. **Repositories**: persistence access (`backend/src/repositories`)

Shared domain models are in the top-level `model/` package and are reused across frontend and backend.

## Current Repository Layout

```text
FantasyWiki/
├── model/
├── backend/
│   ├── migrations/
│   └── src/
│       ├── index.ts
│       ├── routes/
│       │   ├── auth.ts
│       │   ├── leagues.ts
│       │   └── session.ts
│       ├── services/
│       │   ├── login.ts
│       │   ├── player.ts
│       │   ├── leagues.ts
│       │   └── wikimediaClient.ts
│       └── repositories/
│           ├── playerRepository.ts
│           ├── result.ts
│           └── d1/
│               └── playerRepositoryD1.ts
└── frontend/
```

## Layer Responsibilities

### Routes (`backend/src/routes`)
- Parse request input
- Enforce auth/HTTP constraints
- Call services
- Map results to HTTP responses

### Services (`backend/src/services`)
- Implement business logic and orchestration
- Depend on repository interfaces (`PlayerRepository`) rather than route concerns
- Depend on other services whose functionality they need
- Return typed `Result` values consumed by routes

#### Composing services

A service may — and is encouraged to — call another service when that service
already provides something useful. Reuse beats restating: a rule implemented
twice is a rule that will eventually be two different rules. Take the
dependency through the constructor like any repository, so tests can substitute
it, and let the caller's `Result` carry the callee's failure outward rather
than re-wording it.

The rule is one of preference, and it holds even when all you want is the data:
when what service A needs is offered both by service B and by repository C,
reach for B. Go to C only when there is no such B. A service's read is rarely
only a read — it dresses rows into DTOs, fills in derived fields, applies the
rules that decide what counts as absent — and calling it means you inherit
those, including the ones added after you wrote the call. Reaching past it to
the repository buys one fewer hop and gives up all of that.

One limit keeps this from becoming a tangle: **keep the dependencies acyclic**.
If A calls B, B must not call back into A. A cycle usually means the shared
part wants to be its own service (or to move down into a repository) rather
than to be reached for in both directions.

### Repositories (`backend/src/repositories`)
- Define repository contracts (`playerRepository.ts`)
- Implement D1 access in `repositories/d1/playerRepositoryD1.ts`
- Encapsulate SQL and persistence error handling

## Runtime and Data

- Runtime: Cloudflare Workers + Hono (`backend/src/index.ts`)
- Primary persistence: Cloudflare D1 via `db` binding
- Schema and migrations: `backend/migrations/`

## Testing

- Backend tests run with Vitest, in the Workers pool, against a real D1 database
- Command: `cd backend && npm run test`
- Which layer a test may name — and why only `composition.ts` chooses an implementation — is in
  [Backend Testing](../development/backend-testing.md)

## Related

- [Backend Testing](../development/backend-testing.md)
- [Backend Error Constants](./backend-error-constants.md)
- [API Naming Rules](../development/api-naming-rules.md)
- [Wikimedia Client Architecture](./wikimedia-client-architecture.md)
