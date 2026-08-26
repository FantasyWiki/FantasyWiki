---
title: Data flow
description: Sign-in, a request through the layers, buying a contract, a night of scoring, and settlement.
type: guide
---

# Data flow

Five journeys through the system, in the order a reader meets them. Each one
stops at the seam where the detail is documented properly, and links there
rather than restating it.

## 1. Signing in

Identity is Google's; the session is a signed JWT in an HTTP-only cookie. The
frontend never holds a token in JavaScript, and never sends an `Authorization`
header — it sends `credentials: "include"` and the browser does the rest.

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant W as Worker (/auth)
  participant G as Google
  participant D1 as D1

  B->>W: GET /auth/google
  W->>G: OAuth redirect
  G-->>B: consent
  B->>W: GET /auth/google?code=…
  W->>G: exchange code
  G-->>W: profile (googleId, email)
  W->>D1: find or create google_account + player
  D1-->>W: player
  W->>W: sign JWT (HS256)
  W-->>B: Set-Cookie session_token<br/>HttpOnly · Secure · redirect to the app
  B->>W: GET /api/session (cookie)
  W-->>B: the signed-in player
```

Everything under `/api/*` sits behind Hono's JWT middleware reading that cookie.
Two route groups sit deliberately *outside* it: `/auth/*`, which has no session
yet, and `/internal/*`, which is authenticated by a bearer service token instead
because its caller is a batch job, not a person.

The local environment adds one more door. `routes/devAuth.ts` mounts a sign-in
that produces an identical session with no Google round trip — and refuses to
work unless `ENVIRONMENT` is `local`, so a clone can be run by someone who has
no OAuth credentials to obtain.

→ [Local Development Setup](../docs/development/local-dev-setup.md) ·
[Running in Docker](../docs/development/docker-local-dev.md)

## 2. A request through the layers

Every authenticated call takes the same path. What changes between endpoints is
which service is asked, never the shape of the journey.

```mermaid
sequenceDiagram
  autonumber
  participant FE as Frontend
  participant MW as JWT middleware
  participant RT as Route
  participant SV as Service
  participant RP as Repository (interface)
  participant D1 as D1

  FE->>MW: GET /api/leagues/:id/my-team<br/><small>credentials: include</small>
  MW->>MW: verify session_token
  MW->>RT: context + repositories
  RT->>RT: currentPlayer — identity from the JWT, never the URL
  RT->>SV: teamService.forPlayer(leagueId, playerId)
  SV->>RP: teams.findByPlayerAndLeague(…)
  RP->>D1: SELECT …
  D1-->>RP: row
  RP-->>SV: Result of Team or TeamError
  SV-->>RT: Result of TeamDTO or TeamError
  RT-->>FE: 200 · or the status this error maps to
```

Three conventions are doing real work here.

**Identity comes from the session, never from the client.** The API has no
endpoint that accepts a `playerId`; self-scoped data is reached through
`/api/me` or a `my-` prefix, and the route resolves who is asking from the JWT.
Hiding an id from a URL is not a security control — resolving it server-side is.
→ [API Naming Rules](../docs/development/api-naming-rules.md)

**Failures are values, not strings.** Services return a typed `Result`, and
routes map each error constant to a status. Nothing anywhere matches on an error
message. → [Backend Error Constants](../docs/architecture/backend-error-constants.md)

**The route never sees SQL.** It has repositories, which are interfaces. Which
implementation it got was decided once, in `composition.ts`.

### The endpoints, grouped by what they are scoped to

| Scope | Examples |
|---|---|
| Public reads | `GET /api/leagues/public`, `/api/leagues/:id`, `/:id/leaderboard`, `/:id/market` |
| Self-scoped | `/:id/my-team`, `/:id/my-contracts`, `/:id/my-performances`, `/:id/my-notifications`, `/:id/my-role`, `/:id/my-departure` |
| Admin-scoped | `/:id/invite-code`, `/:id/closure` |
| Session | `/api/session`, `/api/me/genie-seeds`, `/api/me/genie-turns` |
| Service-to-service | `/internal/scoring-inputs`, `/internal/performances` |

## 3. Buying a contract

The one flow where the frontend, Wikimedia and the economy all meet.

```mermaid
sequenceDiagram
  autonumber
  participant FE as Frontend
  participant BE as Backend
  participant WM as Wikimedia
  participant D1 as D1

  FE->>BE: GET /api/leagues/:id/market
  BE->>WM: top-read snapshot for the league's edition
  WM-->>BE: ranked articles
  BE->>D1: contracts already held in this league
  BE-->>FE: each article as Free Agent · Owned by Viewer · Owned by Other

  FE->>BE: POST /api/leagues/:id/my-contracts { articleId }
  BE->>WM: 30-day average views
  BE->>BE: price = f(base points, language scale)
  BE->>D1: is the article free? can the team afford it?
  BE->>D1: INSERT contract
  BE-->>FE: the signed contract
```

Two facts about this flow are load-bearing and are specified elsewhere:

- **Price comes from a smoothed 30-day average**, not from today's spike, which
  is what makes a breakout cheap and a giant expensive.
  → [ADR 0005](../docs/adr/0005-contract-pricing.md)
- **Credits are derived, not stored.** A team's balance is a view over its
  contracts and payouts, so a balance and a portfolio can never disagree.
  → [ADR 0007](../docs/adr/0007-derived-team-credits.md)

The three-state availability model, and which actions each state permits, is
[Article Availability](../docs/domain/article-availability.md).

## 4. A night of scoring

Once a day, for every team in every league. Two processes and one contract
between them.

```mermaid
sequenceDiagram
  autonumber
  participant CR as GitHub Actions cron
  participant CO as Scoring Collector (JVM)
  participant BE as Backend Worker
  participant WM as Wikimedia
  participant D1 as D1

  CR->>CO: run for date D
  CO->>BE: GET /internal/scoring-inputs?date=D<br/><small>bearer secret</small>
  BE->>D1: lineups ⋈ contracts active on D
  D1-->>BE: rows
  BE-->>CO: per team: articles, article pairs,<br/>opaque formation snapshot

  par throttled fan-out
    CO->>WM: daily views per article
  and
    CO->>WM: outbound links among the paired articles
  end
  WM-->>CO: raw facts only

  CO->>BE: POST /internal/performances (chunks of 100)
  BE->>BE: apply the curve + language scale
  BE->>D1: UPSERT ON CONFLICT (teamId, date)
  Note over BE,D1: re-running date D is safe
```

The chunking is not incidental: a Worker has a CPU budget, and ingest is
deliberately shaped so each request parses a small JSON body and then waits on
I/O. The formation snapshot is stored as written, so yesterday's score cannot be
changed by rearranging today's team.

→ [Nightly Scoring Pipeline](../docs/architecture/scoring-pipeline.md)

## 5. Settlement at expiry

A separate nightly job, and the only place money changes hands.

```mermaid
flowchart LR
  CRON["Cron trigger<br/><small>~05:00 UTC</small>"] --> WF["ContractSettlementWorkflow<br/><small>durable · resumable</small>"]
  WF --> Q{"Contract reached<br/>the end of its term?"}
  Q -->|"renewal elected"| REN["Renew at the current price"]
  Q -->|"otherwise"| SET["Settle: pay out at value,<br/>book the gain or loss"]
  REN --> N["Notify the owner"]
  SET --> N
  N --> D1[("D1")]

  classDef seam fill:#fdf3d6,stroke:#d8b03a;
  class WF seam;
```

It is a Cloudflare Workflow rather than a request handler because it must
survive interruption: a run that dies halfway through must resume, not restart.
The Worker's `scheduled` handler stays thin — it creates the Workflow instance
and nothing else.

The economics — why there is no stipend, no transaction fee, and why an early
sale is prorated while an expiry settles in full — are
[ADR 0003](../docs/adr/0003-closed-trading-economy.md).

## What the frontend caches, and where

The browser holds three different kinds of state and keeps them apart on
purpose.

```mermaid
flowchart LR
  A["<b>Pinia</b><br/><small>app and UI state<br/>session, theme, onboarding</small>"]
  B["<b>TanStack Query</b><br/><small>server state<br/>leagues, market, lineup, leaderboard</small>"]
  C["<b>localStorage</b><br/><small>what survives a reload</small>"]

  A -->|"explicitly synced inside store actions"| C
  B -->|"keys owned by one module"| K["queryKeys.ts"]

  classDef seam fill:#fdf3d6,stroke:#d8b03a;
  class K seam;
```

Server state is never copied into a store. The one module that owns every query
key is what makes invalidation after a mutation a matter of naming the key
rather than of remembering every place it was used.

→ [Frontend Query Keys](../docs/architecture/frontend-query-keys.md) ·
[Frontend](./frontend.md)

## Related

- [Architecture overview](./index.md) — containers, packages and layers
- [Data model](./data-model.md) — what the tables above actually hold
- [Deployment](./deployment.md) — where each of these processes runs
