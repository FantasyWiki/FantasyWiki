---
title: API Naming Rules
type: development
tags: [conventions, api, rest, security]
---

## FantasyWiki API Naming Rules

### 1. Identifiers in URLs

- Do not expose sensitive identifiers (e.g. `playerId`) in routes if the resource is not meant to be searchable and viewable for normal users.
- Use `:id` in paths **only when**:
    - the resource is publicly or shareably visible (leagues, teams on leaderboards, articles), or
    - the endpoint is an **admin/staff** endpoint with elevated permissions.
- For the current player, **never** require `playerId` in the URL; the backend must resolve identity from the session/JWT.

***

### 2. Plural for collections

- Use **plural nouns** for collections:

    - `GET /api/players` – list players (if that concept exists and is allowed)
    - `POST /api/players` – create a new player
    - `GET /api/leagues` – list leagues
    - `GET /api/articles` – list articles

- Use singular with `:id` for a specific, viewable resource:

    - `GET /api/players/:playerId` – only in admin/special contexts
    - `GET /api/leagues/:leagueId`
    - `GET /api/contracts/:contractId`

***

### 3. `/me` and `my-` for authenticated player data

- **`/api/me`** represents the current authenticated player.

  Use it for self-scoped operations, without sending `playerId`:

    - `GET /api/me` – current player profile
    - `PATCH /api/me` – update own profile
    - `GET /api/me/teams` – my teams
    - `GET /api/me/notifications` – my notifications

- For “my data inside something else” (e.g. inside a league), use the **`my-` prefix**:

    - `GET /api/leagues/:leagueId/my-team`
    - `GET /api/leagues/:leagueId/my-contracts`
    - `GET /api/leagues/:leagueId/my-notifications`

- Rule of thumb: if the product wording is “my X”, the route should use `/me` or `my-` and should **not** take `playerId` from the client.

***

### 4. Path vs body

- If an identifier is in the **path**, do **not** repeat it in the **body**:

    - ✅ `POST /api/teams/:teamId/contracts` with body `{ articleId, startDate, duration, purchasePrice }`
    - ❌ body also includes `teamId` or `teamID` mirroring the path

***

### 5. Authorization (backend)

- “Hiding `playerId` from the URL” is **not** the security model; it’s just nicer API design.
- Real authorization rules:

    - Resolve the authenticated player from session/JWT.
    - Load the requested resource.
    - Check ownership / league membership / role.
    - If not allowed, return `403` or `404` depending on how much you want to reveal.

## Related

- [Backend Architecture](../architecture/backend-architecture.md)
- [Backend Error Constants](../architecture/backend-error-constants.md)
