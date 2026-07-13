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
- Return typed `Result` values consumed by routes

### Repositories (`backend/src/repositories`)
- Define repository contracts (`playerRepository.ts`)
- Implement D1 access in `repositories/d1/playerRepositoryD1.ts`
- Encapsulate SQL and persistence error handling

## Runtime and Data

- Runtime: Cloudflare Workers + Hono (`backend/src/index.ts`)
- Primary persistence: Cloudflare D1 via `db` binding
- Schema and migrations: `backend/migrations/`

## Testing

- Backend tests run with Vitest
- Command: `cd backend && npm run test`
- Integration-focused backend tests are under `backend/src/tests/integration`

## Related

- [Backend Error Constants](./backend-error-constants.md)
- [API Naming Rules](../development/api-naming-rules.md)
- [Wikimedia Client Architecture](./wikimedia-client-architecture.md)
