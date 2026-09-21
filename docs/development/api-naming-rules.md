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

    - `GET /api/v1/players` – list players (if that concept exists and is allowed)
    - `POST /api/v1/players` – create a new player
    - `GET /api/v1/leagues` – list leagues
    - `GET /api/v1/articles` – list articles

- Use singular with `:id` for a specific, viewable resource:

    - `GET /api/v1/players/:playerId` – only in admin/special contexts
    - `GET /api/v1/leagues/:leagueId`
    - `GET /api/v1/contracts/:contractId`

***

### 3. `/me` and `my-` for authenticated player data

- **`/api/v1/me`** represents the current authenticated player.

  Use it for self-scoped operations, without sending `playerId`:

    - `GET /api/v1/me` – current player profile
    - `PATCH /api/v1/me` – update own profile
    - `GET /api/v1/me/teams` – my teams
    - `GET /api/v1/me/notifications` – my notifications

- For “my data inside something else” (e.g. inside a league), use the **`my-` prefix**:

    - `GET /api/v1/leagues/:leagueId/my-team`
    - `GET /api/v1/leagues/:leagueId/my-contracts`
    - `GET /api/v1/leagues/:leagueId/my-notifications`

- Rule of thumb: if the product wording is “my X”, the route should use `/me` or `my-` and should **not** take `playerId` from the client.

***

### 4. Path vs body

- If an identifier is in the **path**, do **not** repeat it in the **body**:

    - ✅ `POST /api/v1/teams/:teamId/contracts` with body `{ articleId, startDate, duration, purchasePrice }`
    - ❌ body also includes `teamId` or `teamID` mirroring the path

***

### 5. Authorization (backend)

- “Hiding `playerId` from the URL” is **not** the security model; it’s just nicer API design.
- Real authorization rules:

    - Resolve the authenticated player from session/JWT.
    - Load the requested resource.
    - Check ownership / league membership / role.
    - If not allowed, return `403` or `404` depending on how much you want to reveal.

***

### 6. Versioning

- The **major version is a path segment**, right after the surface it versions:
  `/api/v1/...` for the SPA's API, `/internal/v1/...` for the scoring
  collector's. A route is added under the current version, never beside it.
- `info.version` in `backend/openapi.yaml` is the version of the contract, and
  its major must equal the segment: `1.x.y` describes `/v1`. An additive change,
  a new route or an optional field, bumps the minor.
- A **breaking change** (a removed or renamed route or field, a narrower type, a
  new required input) moves to `/v2`, and `/v1` stays mounted beside it until
  every client has moved. That is the point of versioning by path: the two can
  be served at once, by one Worker.
- **`/auth` is not versioned.** It is the OAuth handshake, not a data contract,
  and its redirect URIs are registered with Google, so moving it would break
  sign-in on the next deploy for no client's benefit.
- The API version is not the release version. A breaking API change is always a
  major release; a major release need not change the API.
  See [Release Process](./release-process.md).

## Related

- [OpenAPI Spec](../agents/openapi-spec.md)
- [Release Process](./release-process.md): how the release version relates to the API's
- [Backend Architecture](../architecture/backend-architecture.md)
- [Backend Error Constants](../architecture/backend-error-constants.md)
