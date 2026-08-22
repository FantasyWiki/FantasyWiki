---
title: Nightly Scoring Pipeline
type: architecture
tags: [scoring, collector, kotlin, github-actions, wikimedia]
---

# Nightly Scoring Pipeline

Every night a batch scores **every team in every league** on the previous UTC
day's Wikipedia pageviews. This doc describes how that pipeline is put together.
The rules it implements — the Base Points curve, Chemistry values, the team cap,
cumulative totals — are stated once in
[Scoring & Economy System](../domain/scoring-system.md) and
[Chemistry Links](../domain/chemistry-links.md); they are not restated here.

## Shape of the pipeline

```
GitHub Actions (cron ~05:00 UTC, master only, production environment)
        │
        ▼
 :scoring-collector  (Kotlin/JVM)
        │  1. GET  /internal/scoring-inputs?date=D   ──► backend (Worker)
        │  2. per-article daily views (AQS)          ──► Wikimedia
        │     link graph among paired articles       ──► Wikimedia (≤3 concurrent)
        │  3. POST /internal/performances (chunked)  ──► backend ──► D1 `performances`
        ▼
 backend reads D1 exactly as before
 (/:id/my-performances, /:id/leaderboard — untouched by this pipeline)
```

Two properties hold the design together:

**The collector computes nothing.** It POSTs *raw facts* — per-article daily
views and each Chemistry Link's resolved level — and the backend turns them into
points via the single implementation in `model/scoring.ts` (which `pricing.ts`
also imports). One `basePoints` in the repo, in one language, so the TS and JVM
runtimes cannot drift.

**The collector knows nothing about the game.** No schema, position, formation,
or language calibration: the backend resolves `CHEMISTRY_LINKS[schema]` against
the placed articles and hands over a flat list of article *pairs*. Adding a
formation touches `model/enums.ts` only. `formationSnapshot` is an opaque string
the collector echoes back untouched.

The collector talks to exactly two surfaces: the backend (one bearer secret) and
Wikimedia (public). It holds no D1 credential and no persistent state.

## Component 1 — backend `/internal` endpoints

`backend/src/routes/internal.ts`, mounted **outside** the `/api/*` Google-JWT
guard (`app.route("/internal", internal)`) behind Hono's `bearerAuth` comparing
against `c.env.SCORING_INGEST_SECRET`.

- **`GET /internal/scoring-inputs?date=YYYY-MM-DD`** → one row per team across
  all leagues: `{ leagueId, teamId, domain, articles[], chemistryLinks[[a,b]],
  formationSnapshot }`. Backed by `ScoringService` joining `lineups` with active
  contracts (`settled = 0` and `purchaseDate ≤ D < expireDate`), resolving
  `position → contractId → articleId`.
- **`POST /internal/performances`** → idempotent chunked upsert of
  `{ date, results: [{ teamId, articleViews[], chemistryLevels[],
  formationSnapshot }] }`. `PerformanceRepository.upsertDaily` issues
  `INSERT … ON CONFLICT(teamId, date) DO UPDATE` inside `db.batch()` chunks, so
  re-running a day is safe and the Worker stays inside its CPU budget (it parses
  a small JSON chunk and awaits I/O). The Language Scale Factor `L` is applied
  here, at ingest.

## Component 2 — the `:scoring-collector` module

The repo's first compiled Gradle module (Gradle otherwise shells out to npm).
Kotlin/JVM 21, `application` plugin, Ktor client + kotlinx-serialization,
coroutines for the throttled fan-out. Tests are Kotest against a Ktor
`MockEngine`.

```
scoring-collector/src/main/kotlin/io/github/fantasywiki/collector/
  Main.kt            # resolve D → GET inputs → collect → POST → exit code
  Config.kt          # BACKEND_URL, SCORING_INGEST_SECRET, WIKIMEDIA_USER_AGENT, --date, concurrency
  Model.kt           # @Serializable ScoringInput, PerformanceResult, ingest body
  BackendClient.kt   # GET inputs, POST performances (bearer, chunked at 100)
  WikimediaClient.kt # dailyViews (AQS) + outboundLinksAmong (Action API); Chemistry.classify
  Collector.kt       # fetch/dedup/assemble orchestration — backend-free, fully testable
  Titles.kt          # canonical title normalization
```

`Collector.collect` is deliberately backend-free: it takes inputs and returns
results, so a whole run can be exercised against a `MockEngine`.

## Where the cost is

**Views dominate; chemistry is a rounding error.**

| | friends-scale (~150 articles) | ADR 0004 ceiling (~6k) |
|---|---|---|
| Views (AQS, 1 per distinct article) | ~150 calls — **dominant** | ~6k calls — **dominant** |
| Links (batched) | ~1 call | ~⌈N/50⌉² calls |

AQS is single-title with no batch form, so `N_distinct_articles` requests a night
is the irreducible floor. Deduping by `(domain, canonicalTitle)` across all teams
is the single biggest lever — one popular article held by many teams is fetched
once.

Links go the other way. `prop=links` accepts up to **50 values in `titles` and in
`pltitles` alike**, so setting `titles = pltitles = the article set` returns the
whole directed adjacency in one request — every pair classified locally from it
(`A→B` iff `B ∈ links(A)`). `WikimediaClient.outboundLinksAmong` does this,
chunking the set into ≤50 blocks and walking the block grid, so a domain's whole
pool costs ~1 request while it stays under 50 articles.

Three constraints that shape that code, each a silent-corruption risk if ignored:

- **50 values is a hard cap**, not a truncation — exceeding it fails the request
  with `toomanyvalues`.
- **`pllimit=max` is 500 link rows per response across all pages**, which a full
  50×50 block can exceed. The response then carries a `plcontinue` token and
  omits the rest; dropping it would read as "no link" and downgrade a Chemistry
  Link to Weak. The client drains the token.
- **Never fetch unfiltered link lists.** A hub article has thousands of outbound
  links; the `pltitles` filter is what keeps every response bounded.

## Caching

- **Within a run — always.** Dedup view fetches by `(domain, title)`; the link
  graph is resolved once per domain and shared by every team.
- **Between runs — no.** Views are the daily signal and cannot be cached, so the
  expensive half is re-paid regardless. Links are already cheap. GitHub runners
  are ephemeral, and the collector holds no D1 credential, so a cross-run cache
  would have to become a backend-owned `article_links` table plus an `/internal`
  lookup — real backend work to cache the part that is not the bottleneck.
  Deferred, per ADR 0004's "D1-backed cache is a later optimization."

## Title normalization

The likeliest correctness bug in the pipeline. Three title sources must
reconcile: the stored `articleId`, AQS pageview titles, and Action-API link
titles. Wikipedia treats `_` ≡ space and is case-insensitive on the **first
character only**. `Titles.canonical` (underscores→spaces, collapse whitespace,
upper-case first char) is applied to *both* sides of every comparison — otherwise
chemistry silently reads as "no link."

The Action API normalizes source titles by the same first-character rule, so
response titles and caller titles agree. A `missing` page yields no outbound
links. Note that a case-variant title resolves to a *redirect* page, whose links
are the redirect's, not the article's.

## Component 3 — the workflow

`.github/workflows/scoring.yml`. `schedule:` only ever fires from the default
branch, so the nightly run always executes master's collector — it is not
per-branch deployed the way the Worker is.

It scores **production only**, in the `production` GitHub Environment (which
selects the production ingest secret and can carry protection rules). QA gets no
scored data from this workflow. `workflow_dispatch` takes a `date` input for
backfill.

### What runs, and where

The workflow runs the collector as the **container image** published to GHCR by
`publish-images.yml` — `ghcr.io/fantasywiki/scoring-collector:latest` — not as a
Gradle build of the checked-out source. No checkout, no JDK, and the nightly
scores exactly the artefact that was published for master.

That is also what makes the *where* replaceable. The collector is a stateless
single-shot process — three environment variables in, HTTP out, exit code as
the verdict — so anything that can pull an image and run it on a timer can be
the scheduler. There are two supported ones.

**Option 1 — a GitHub runner. The default, and what runs today.** Nothing to
set up: `schedule:` fires it and the `production` Environment selects the right
ingest secret.

**Option 2 — anywhere that can run a container.** Set the repository variable
`SCORING_RUNNER=external` so this workflow stands down, then run the same image
on your own timer:

```bash
docker run --rm \
  -e BACKEND_URL=https://backend.luca0patrignani.workers.dev \
  -e SCORING_INGEST_SECRET \
  -e WIKIMEDIA_USER_AGENT="FantasyWiki/1.0 (https://fantasywiki.pages.dev; you@example.com)" \
  ghcr.io/fantasywiki/scoring-collector:sha-<short> \
  --date=2026-08-21
```

- **`--date` is optional** and defaults to the last completed UTC day. Pass it
  only to backfill.
- **`-e SCORING_INGEST_SECRET` carries no value on purpose.** That form
  forwards the variable from the calling environment, keeping the secret off a
  command line any process listing could read. The other two are public.
- **Pin `sha-<short>`, not `latest`.** An external scheduler following `latest`
  changes collector on every master merge without anyone deciding to; the sha
  tag is the one a rollback can name.
- **Pulling needs `read:packages`** unless the package is public. `scoring.yml`
  gets away with the automatic `GITHUB_TOKEN`, which nothing outside Actions
  has — an external host needs its own token.
- Schedule it after ~05:00 UTC, for the AQS reason below, and keep only one
  scheduler live.

The switch itself:

| `SCORING_RUNNER` | The nightly |
|---|---|
| unset | Runs here, on a GitHub runner. **Default.** |
| `external` | Skipped — something else owns the day. |

A manual `workflow_dispatch` runs regardless of the variable, which is how you
backfill a day while the handover is in place. An unrecognised value runs here,
deliberately: the ingest upserts on `(teamId, date)`, so scoring twice costs
only Wikimedia budget while scoring neither costs a missing day, and a typo
should fail toward the cheap mistake.

`external` is a **handover, not a pause** — the schedule stays wired up, so
clearing the variable resumes scoring with nothing else to change. Only one
scheduler should be live at a time, for the same rate-budget reason.

Because the image is the unit of delivery, **a failed publish breaks the
nightly**: `latest` only moves when `publish-images.yml` is green. That coupling
is the price of not rebuilding the collector every night.

- Cron is ~05:00 UTC, ~2h after AQS publishes day `D`; GitHub's 10–30 min jitter
  is absorbed by that buffer.
- `BACKEND_URL` and `WIKIMEDIA_USER_AGENT` are public and inlined; only
  `SCORING_INGEST_SECRET` is a secret (repo secrets
  `SCORING_INGEST_SECRET_{PRODUCTION,PREVIEW}`, also set on the Worker envs).
- Wikimedia requires a descriptive contactable User-Agent or it answers 403 —
  which the view resolvers would swallow into `undefined` views. `Config` reads
  it via `required()`, so a missing value fails the run at startup instead.
  Concurrency is capped at 3, per Wikimedia's guidance.

**Rate limits.** `Semaphore(3)` caps requests *in flight*, which is not a rate
cap — three concurrent requests at ~150 ms each sustain far more than the
200/min a compliant unauthenticated client gets, so a large enough pool will be
throttled. On 429 (or 5xx) the client waits a minute — or `Retry-After`, when
the response names a longer one — and retries, up to three times
(`collectorHttpDefaults`).

**Errors and idempotency.** A genuine per-article view gap (404) is a soft
warning scored as 0. Every *other* non-2xx aborts the run: AQS answers errors
with `application/problem+json`, which deserializes into an empty `AqsResponse`
indistinguishable from "no data", so without an explicit status check a
throttled article would silently score 0 and the job would still exit green.
Backend auth/5xx or network failure aborts non-zero too. The collector is
stateless and the backend upserts on `(teamId, date)`, so re-runs and backfills
are safe.

## Divergence from ADR 0004

[ADR 0004](../adr/0004-scoring-engine-platform.md) locked **Kotlin + GCP Cloud
Run Jobs + direct D1 writes**. Only the Kotlin part survived; the pipeline as
built diverges on the other two:

- **Host: GitHub Actions, not Cloud Run.** Free is a hard constraint, and Actions
  is already the repo's CI home — the fewest new moving parts. Cloud Run's free
  tier also works but adds a whole GCP account/IAM/Artifact Registry surface.

  Partly reopened: the collector now *is* a container image, and
  `SCORING_RUNNER=external` hands the schedule over without touching code — so
  the host is no longer a property of the code at all, only of where that image
  is run. That removes the *packaging* obstacle to ADR 0004's host, not the
  whole objection: Cloud Run pulls only from Artifact Registry or GCR, so
  targeting it specifically still needs the image mirrored there and the GCP
  account this divergence was avoiding. Anything that can pull a public OCI
  image (a VPS, Fly.io, a scheduler on a machine you own) needs no mirror.
- **Delivery: POST-through-backend, not direct D1.** The backend stays the sole
  D1 writer and enforces its own invariants, instead of the collector holding a
  whole-database write token.

ADR 0004's autonomy-from-backend rationale is weakened either way (the collector
depends on the backend endpoint regardless), and its scheduling-precision
rationale is neutralized by the ~2h publication buffer. This divergence is
recorded here rather than in a superseding ADR — worth promoting to one if the
platform is revisited.

## Known gaps

| Item | State |
|---|---|
| Language Scale Factor `L` | Read from the scored team's league (`leagues.languageScale`), frozen when that league was founded. An edition with no measurement cannot host a league at all — `LanguageScaleCalibrationService` measures it at creation time or refuses it ([ADR 0002](../adr/0002-language-scale-factor.md), [language editions](../domain/language-editions.md)) — so the scoring path never has to ask whether a factor exists. |
| `CHEMISTRY_MULTIPLIER_BY_LEVEL` | Deprecated display-only leftover in `model/enums.ts`. Chemistry is **additive**, never a multiplier — see [ADR 0001](../adr/0001-base-scoring-model.md). Must never reach a scoring path. |
| Client-side chemistry levels | `frontend/src/services/teamService.ts` computes levels for display only; the pipeline is authoritative and the frontend value must never feed back into scoring. |
| Link-call clustering | Block-grid chunking is ⌈N/50⌉² past 50 articles per domain. Union-find components bin-packed into ≤50 batches would be ~⌈N/50⌉ — the better optimization when a pool outgrows one request. |
| Weekly tournament / event bonuses | Deferred (see `domain/scoring-system.md` §7 and ADR 0004). |

## Related

- [Scoring & Economy System](../domain/scoring-system.md) — the rules this pipeline applies
- [Chemistry Links](../domain/chemistry-links.md) — what a Chemistry Link is
- [ADR 0001: Base Scoring Model](../adr/0001-base-scoring-model.md)
- [ADR 0002: Language Scale Factor](../adr/0002-language-scale-factor.md)
- [ADR 0004: Scoring Engine Platform](../adr/0004-scoring-engine-platform.md) — superseded in part, see Divergence
- [Backend Architecture](./backend-architecture.md) — the layering `/internal` sits in
- [Wikimedia Client Architecture](./wikimedia-client-architecture.md) — the *frontend/backend* Wikimedia client, separate from the collector's
- [Running FantasyWiki in Docker](../development/docker-local-dev.md) — the workflow that publishes the collector image
- [Deploy Strategy](../deployment/deploy-strategy.md) — which backend the workflow targets
