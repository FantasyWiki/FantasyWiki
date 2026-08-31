---
title: Sessions and Sign-in Doors
type: architecture
tags: [auth, session, jwt, cookie, middleware]
---

# Sessions, and the doors that mint one

There is **one session** in FantasyWiki: a signed JWT in an HTTP-only
`session_token` cookie. Three doors mint it, one guard reads it, and one
middleware turns it into a player. Which doors a build has is
[Auth Modes](./auth-modes.md); what a session *is* is here.

The rule the whole arrangement exists to keep: **a session says who the caller
is and nothing else.** No feature downstream may care which door the player came
through, because the moment one does, every new door has to be added to it.

## The three doors

| door | mounted at | available where |
| --- | --- | --- |
| Google OAuth | `/auth/google` (`routes/auth.ts`) | every build |
| Local demo sign-in | `/auth/dev` (`routes/devAuth.ts`) | only where `ENVIRONMENT` is `local` |
| Username / password | `/auth/password/*` (`routes/passwordAuth.ts`) | only the entry that mounts it |

The demo door is the Google flow with the identity provider removed, the same
`LoginService` call, the same claims, the same cookie, the same redirect, so a
demo player is an ordinary player and the app has no idea it exists. It signs in
as a fixed account whose id (`dev-local-player`) cannot collide with a Google
subject, which are numeric.

Outside a local run it answers **404, not 403**. Saying "forbidden" would
advertise that the route exists somewhere; the frontend gates its button on a
separate Vite variable, so neither side has to trust the other.

## Minting: one function, and a deliberate exception

`routes/issueSession.ts` signs the claims and sets the cookie, and both the demo
door and the password door call it. A hand-copied cookie is how two doors come to
disagree about `secure` or about the expiry, drift that nothing fails on.

```
claims { sub, email?, name, picture } + exp (7 days)
   → HS256 over JWT_SECRET
   → Set-Cookie session_token; HttpOnly; SameSite=Lax; Path=/; Max-Age=7d
```

`secure` mirrors the frontend URL's scheme, so the cookie also works over
`http://localhost`. `SameSite=Lax` is sufficient because the proxy, a
Cloudflare Pages Function in production, the Vite dev proxy locally, serves
frontend and backend under one origin, which makes the cookie first-party.
`email` is optional: a password account has none, so it is absent from the
payload rather than an empty string on the wire.

**`routes/auth.ts` still mints its own**, and that is on purpose. It is
production sign-in, and unlike the demo door nothing tests its claims or its
cookie, only `resolveFrontendUrl` is covered. Folding it in is a change to the
one path whose failure locks every real user out, and it is worth doing behind a
test of its own rather than as a side effect of adding a second way to log in.

## Reading: the guard, and what it does not cover

```
/api/*      → hono/jwt over the session_token cookie          → 401 without one
/internal/* → bearer secret, constant-time compare            → 401 without it
/auth/*     → unguarded: these are the doors
```

The scoring collector is not a user, so `/internal/*` sits **outside** the
`/api/*` guard and authenticates with a shared service token instead, an unset
secret fails closed. See [Nightly Scoring Pipeline](./scoring-pipeline.md).

A valid session is not yet a player. `currentPlayer` (`routes/currentPlayer.ts`)
resolves the JWT subject to a player row and puts it on the context, so a handler
reads `c.var.player` instead of repeating the lookup and the same status mapping.
**Identity comes from the subject and never from the request**, which is what
lets the self-scoped endpoints keep `playerId` out of their URLs entirely
([API Naming Rules](../development/api-naming-rules.md)).

It is opted into per route rather than mounted across `/api/*`: the league,
market and leaderboard reads are deliberately not membership-scoped, and would
start answering 404 for a signed-in visitor who has not created a player yet.

## What the session tells the frontend

`GET /api/session` echoes the claims back and adds `features`, read off the
Worker's own bindings, not off config. A deployment that was never given the
Workers AI binding cannot answer for the Article Genie whatever a variable says,
so the frontend hides the entry point rather than offering a feature that 500s
([Article Genie](./article-genie-llm.md)).

Signing out is `DELETE /api/session`, which expires the same cookie. The
frontend keeps `isAuthenticated` in the app store and its router guard bounces a
protected route to `/home` **with the login modal already open**, a silent
redirect is indistinguishable from a broken link.

Every frontend request is sent with `credentials: "include"`; the cookie is
never read by script, which is the point of `HttpOnly`.

## Where each piece lives

| concern | code |
| --- | --- |
| signing and setting the cookie | `backend/src/routes/issueSession.ts` |
| the doors | `routes/auth.ts`, `routes/devAuth.ts`, `routes/passwordAuth.ts` |
| the guard | `app.use("/api/*", jwt(...))` in `backend/src/app.ts` |
| subject → player | `backend/src/routes/currentPlayer.ts` |
| session echo and feature flags | `backend/src/routes/session.ts` |
| service-token guard | `backend/src/routes/internal.ts` |
| client state and the redirect | `frontend/src/stores/app.ts`, `frontend/src/router/index.ts` |

## Related

- [Auth Modes](./auth-modes.md): why one build has passwords and the deployed one cannot
- [API Naming Rules](../development/api-naming-rules.md): identity resolved server-side
- [Nightly Scoring Pipeline](./scoring-pipeline.md): the caller that is not a user
- [Running FantasyWiki in Docker](../development/docker-local-dev.md): where the demo door is used
