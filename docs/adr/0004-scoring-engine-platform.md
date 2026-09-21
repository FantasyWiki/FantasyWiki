---
title: "ADR 0004: Scoring Engine Platform"
type: adr
tags: [scoring, platform, kotlin, github-actions, containers, decision]
---

# Daily scoring as a separate Kotlin/JVM batch, scheduled by GitHub Actions

> **Status:** decided and implemented. The platform choice — a standalone
> Kotlin/JVM batch, autonomous from the Worker, as the project's second target
> platform — is what runs. Two mechanisms were revised between the decision and
> the implementation, the scheduler and the delivery path; both are recorded
> under [Alternatives considered](#alternatives-considered) with the constraint
> that decided each. What runs in detail is
> [Nightly Scoring Pipeline](../architecture/scoring-pipeline.md).

**Decision.** The daily scoring engine is a **standalone Kotlin/JVM service**,
packaged as a container image published to GHCR and run once a night by a
**GitHub Actions** cron. It reads its inputs from the backend over
`GET /internal/scoring-inputs`, sources pageviews from the **per-article
Wikimedia Analytics API**, resolves chemistry links against Wikimedia, and posts
**raw facts** back over `POST /internal/performances`. It computes no points: the
backend turns facts into scores through the single implementation in
`model/scoring.ts`. It holds no database credential and no persistent state.

It is the SPE **second target platform** — a JVM runtime distinct from the
all-V8/JS frontend and backend, and the repository's first compiled Gradle
module.

## Why this batch cannot run on a Worker

This is the analysis that moved the batch off Cloudflare, and it is unchanged by
everything that was revised later. **The per-invocation Worker limits make the
batch infeasible.** The free "100k requests/day" allowance is a *request count*;
a daily batch is **1 invocation/day**. The binding limits are per-invocation:

| Limit (per invocation) | Free | Paid ($5/mo) | Needed by the batch | Source |
|---|---|---|---|---|
| CPU time | **10 ms** | 30 s → 5 min; cron ≥1h → 15 min | fetch and score every league, daily | [1][2] |
| Memory | **128 MB** | **128 MB** (unchanged) | hold the working set | [2] |
| Subrequests | **50** | raised, not unlimited | one fetch per contracted article, plus the link graph | [2] |
| Requests/day | 100,000 | 10M/mo | **1** | [1] |

**Subrequests are the binding constraint.** A night's work is one range request
per distinct contracted article, plus the link graph among the paired ones:
~150 calls at the scale the game is actually played at, ~6k at the ceiling this
ADR budgets for. A Worker invocation is allowed 50, and the smaller of those
numbers already exceeds it threefold.

No Workers tier fixes this: the free tier is impossible on CPU time alone
(**10 ms**), the paid tier lifts CPU and subrequests but **not the 128 MB
ceiling** and not to "unlimited", it costs money, and a Worker is still V8 — the
same platform as the frontend and backend, so it would add **no** second runtime
and satisfy none of the exam's platform requirement either.

A separate runtime, with no per-invocation ceiling and its own concurrency
control, is the only shape that fits.

## The chosen stack

| Layer | Choice | Why | Source |
|---|---|---|---|
| **Runtime** | **Kotlin / JVM** | The first real compiled Gradle module in a repository where Gradle otherwise only shells out to `npm`; the build is already `.kts`, so one language spans build script and module. Coroutines give the throttled per-article fan-out. |, |
| **Packaging** | **Container image on GHCR** | `publish-images.yml` builds `scoring-collector` from `docker/scoring-collector.Dockerfile` on every `master` and `dev`. The host becomes a property of *where the image runs*, not of the code. |, |
| **Scheduling** | **GitHub Actions cron**, `0 5 * * *` | Already the repository's CI home, so it adds no account, no IAM surface and no second place to look when a run fails. Free at this cadence. `SCORING_RUNNER=external` hands the schedule to something else without touching code. |, |
| **Pageviews** | **Per-article Analytics (AQS) API**, one range request per article | One request returns the whole 30-day daily history for an article, so **≤ ~6k** distinct contracted articles cost **~6k requests/day**, comfortably inside a nightly batch. Targeted, clean JSON, no bzip2 and no title matching. Pageview Complete dumps stay the scale-out fallback past tens of thousands of articles. | [3][4][8] |
| **Delivery** | **`/internal/*` on the backend** | The backend stays the only writer of its own database. See below. |, |

## Why the collector posts facts instead of writing the database

The collector could have held a database token and written its results directly.
It does not, and the reason is an invariant rather than a convenience.

**The backend is the sole writer of its own store.** Every rule about what a
valid performance row is — the scoring curve, the Language Scale Factor, the
idempotency of a re-run — lives above the repository layer, in code the collector
does not have. A second writer would either duplicate those rules in Kotlin, and
they would drift, or write rows that satisfy none of them.

So the seam is two endpoints on `backend/src/routes/internal.ts`, mounted
*outside* the `/api/*` JWT guard and behind Hono's `bearerAuth`, because the
caller is a batch job rather than a person:

- **`GET /internal/scoring-inputs?date=D`** hands back one row per team: the
  articles it fielded, the article *pairs* chemistry is resolved over, and an
  opaque formation snapshot the collector echoes back untouched.
- **`POST /internal/performances`** takes raw facts in chunks of 100 and upserts
  them, `INSERT … ON CONFLICT(teamId, date) DO UPDATE` inside `db.batch()`, so
  re-running a date overwrites and cannot duplicate.

Three properties fall out of this, and all three are worth more than the autonomy
the direct-write design would have bought:

- **One scoring implementation, in one language.** `model/scoring.ts` is the only
  `basePoints` in the repository, and `pricing.ts` imports it too. The JVM and TS
  runtimes cannot disagree about what a day was worth, because only one of them
  computes it.
- **The collector knows nothing about the game.** No schema, position, formation
  or language calibration. Adding a formation touches `model/enums.ts` and
  nothing in the Kotlin module.
- **The blast radius of the batch's secret is two endpoints**, not a whole
  database. The collector talks to exactly two surfaces: the backend, with one
  bearer secret, and Wikimedia, which is public.

Chunking at 100 also keeps each backend invocation inside the Worker limits
tabulated above — the ingest side of the pipeline is many small invocations, each
of which parses a small JSON chunk and awaits I/O, which is exactly the shape a
Worker is good at.

## Data sourcing and rate budget

Pageviews and links are fetched per article, so the **Wikimedia rate limits**,
not Worker limits, are the operative constraint. They are comfortably met because
the daily *volume* is small and the *throughput* is paced; a compliant
`User-Agent` carrying contact information is mandatory and lifts the floor:

| Client | Limit | Time to fetch ~6k articles | Source |
|---|---|---|---|
| Unauthenticated, bare IP | 10 req/min | ~10 h ✗ | [3] |
| **UA-compliant** | **200 req/min** | **~30 min ✓** | [3] |
| Authenticated (token) | 2,000 req/min | ~3 min ✓ | [3] |
| Concurrency (recommended) | ≤ 3 concurrent |, | [3] |

→ Run as a UA-compliant client at **≤3 concurrent**; ~6k requests is 3–30 minutes
of a batch that has all night. Friends-scale leagues are far smaller. Links
follow the same budget.

### Authentication

Authentication is **headroom, not a requirement**: a UA-compliant unauthenticated
client already gets 200 req/min, enough for ~6k articles. Authenticating raises
the ceiling to **2,000 req/min** and gives Wikimedia a contactable identity.

- **Flow:** OAuth 2.0 *client credentials*, non-interactive and server to server.
  Register at `Special:OAuthConsumerRegistration/propose/oauth2` on Meta-Wiki for
  a client ID and secret [9].
- **Per run:** exchange them for an access token (valid **4 h**, far longer than
  a run), then send `Authorization: Bearer <token>` and the contact-info
  `User-Agent` on every request [9].
- **Secrets** live in GitHub Actions secrets, alongside the backend's bearer
  token, and reach the container as environment variables.
- **Caveat:** the 2,000/min tier requires an *established* account [3]; a fresh
  one still gets 200/min. Harmless either way, since 200/min already suffices.

## Alternatives considered

**Cloud Run Jobs with Cloud Scheduler**, which this ADR originally chose. Both
are free at this cadence and run containers to completion with no cluster to
operate. It lost to GitHub Actions on a single constraint: Actions is already
where this repository's automation lives, so it adds no Google Cloud account, no
IAM surface, and no second place to look when a nightly run fails. The choice is
also no longer expensive to revisit — the collector *is* a container image, and
`SCORING_RUNNER=external` hands the schedule over without a code change. The one
remaining obstacle is specific to Cloud Run: it pulls only from Artifact Registry
or GCR, so targeting it needs the GHCR image mirrored. Anything that can pull a
public OCI image — a VPS, Fly.io, a scheduler on a machine you own — needs no
mirror at all.

**Direct D1 writes over the REST API**, with the collector holding a database
token. Rejected for the invariant above: it would have made the collector a
second writer of rules it does not contain. Its one advantage was independence
from the backend's uptime, and that advantage is smaller than it looks — the
collector reads its inputs from the backend regardless, so a backend that is down
stops the run either way.

**Running the batch on a paid Workers plan.** Rejected on the limits table: the
memory ceiling does not move, subrequests are raised rather than removed, and it
would add no second runtime.

## Scope and behaviour

- **Cadence:** daily at **~05:00 UTC**, scoring the last completed UTC day *D*,
  roughly two hours after Wikimedia publishes that day's figures. Idempotent on
  re-run.
- **Responsibilities:** scoring only. The economy — credits, pricing, expiry,
  settlement — stays in the backend, which remains the single money writer.
- **Scope:** per-league daily performances for every league, public and private,
  scored identically. The weekly and monthly tournaments in the original game
  design are **not built**; nothing in this pipeline assumes them.
- **State:** none in the collector. It is stateless compute between two
  endpoints and one public API.

## Consequences

- **Two target platforms, unambiguously.** Kotlin/JVM differs from V8 on the
  runtime *and* is the repository's first compiled Gradle module, so the exam's
  platform requirement is met without a borderline reading, and the build-process
  story gains a real compiled module.
- **One scoring formula.** Keeping computation in the backend is what makes this
  true, and it is checked by the tests that exercise `model/scoring.ts` from both
  sides.
- **The host is a deployment detail.** Because the collector ships as an image
  and reads its schedule from the environment, moving it costs a workflow file,
  not a rewrite.
- **Accepted cost:** no type sharing with the TypeScript DTOs. The collector
  re-declares the handful of wire shapes it touches as Kotlin data classes, and a
  change to those endpoints has to be made in two languages.
- **Accepted cost: a small second platform.** Keeping every rule in the backend
  leaves the collector a fetcher, a small module beside the TypeScript codebase.
  The larger JVM module this ADR first planned would have held a second copy of
  the scoring rules, which is the drift the decision above exists to prevent.
  Why that trade was taken over the platform split is on
  [Technologies](https://fantasywiki.github.io/FantasyWiki/overview/technologies.html).
- **Supersedes** the Requirements document's §2/§4 daily-at-00:00 and
  global-tournament framing; `docs/domain/fantawiki-requirements.md` is
  reconciled to match.

## Sources

1. Cloudflare Workers, Pricing: https://developers.cloudflare.com/workers/platform/pricing/
2. Cloudflare Workers, Limits: https://developers.cloudflare.com/workers/platform/limits/
3. Wikimedia APIs, Rate limits: https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits
4. Wikimedia, Pageview Complete dumps: https://dumps.wikimedia.org/other/pageview_complete/
5. Google Cloud, Always Free features (Cloud Run): https://cloud.google.com/free/docs/free-cloud-features
6. Google Cloud, Cloud Scheduler pricing: https://cloud.google.com/scheduler/pricing
7. Cloudflare D1, Limits: https://developers.cloudflare.com/d1/platform/limits/
8. Wikimedia, Analytics (AQS) pageviews API: https://doc.wikimedia.org/analytics-api/
9. Wikimedia APIs, Authentication (OAuth 2.0 client credentials): https://www.mediawiki.org/wiki/Wikimedia_APIs/Authentication

## Related

- [Nightly Scoring Pipeline](../architecture/scoring-pipeline.md): the pipeline as built, endpoint by endpoint, with the cost analysis and the caching
- [Backend Architecture](../architecture/backend-architecture.md): the layering `/internal` sits in
- [Scoring & Economy System](../domain/scoring-system.md)
- [Deploy Strategy & Branch Policy](../deployment/deploy-strategy.md)
