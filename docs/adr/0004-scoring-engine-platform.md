---
title: "ADR 0004: Scoring Engine Platform"
type: adr
tags: [scoring, platform, gcp, decision]
---

# Daily scoring as a separate Kotlin/JVM batch service on Cloud Run Jobs

**Decision.** The daily scoring engine is a **standalone Kotlin/JVM service** packaged as a container and run as a scheduled **GCP Cloud Run Job** (triggered by **Cloud Scheduler**). It reads contracts and writes scores/standings to **D1 via the REST API**, sources pageviews from the **per-article Wikimedia Analytics API**, resolves chemistry links through a **D1-backed cache**, and computes base points + chemistry + the weekly tournament once per day. It is autonomous from the Cloudflare backend, and it is the SPE **second target platform** (a JVM runtime distinct from the all-V8/JS frontend + backend).

## Why this batch cannot stay on Cloudflare

**The per-invocation Worker limits make the batch infeasible.** The free "100k requests/day" is a *request count*; a daily batch is **1 invocation/day**. The binding limits are per-invocation:

| Limit (per invocation) | Free | Paid ($5/mo) | Needed by batch | Source |
|---|---|---|---|---|
| CPU time | **10 ms** | 30 s → 5 min; cron ≥1h → 15 min | fetch + score every league daily | [1][2] |
| Memory | **128 MB** | **128 MB** (unchanged) | hold the working set | [2] |
| Subrequests | **50** | raised, not unlimited | per-article fetch + D1 writes | [2] |
| Requests/day | 100,000 | 10M/mo | **1** | [1] |

→ Free tier is impossible (**10 ms CPU**); paid lifts CPU/subrequests but **not the 128 MB ceiling**, costs money, and a Worker is still V8 — the same platform as the frontend/backend, so it would add **no** second runtime. No Workers tier fixes it.

## The chosen stack

| Layer | Choice | Why | Source |
|---|---|---|---|
| **Runtime** | **Kotlin / JVM** | **First real compiled Gradle module** in the repo (today Gradle only shells out to `npm`); build is *already* `.kts`, so one language spans build script + module. First-class `kotlin-jvm` plugin; coroutines give the throttled per-article fan-out. | — |
| **Hosting** | **Cloud Run Jobs + Cloud Scheduler** | Managed run-to-completion containers on managed scheduling (no cluster); zero-ops; free. JVM boot per run is in-quota and irrelevant for a non-latency-sensitive daily batch. | [5][6] |
| **Pageviews** | **Per-article Analytics (AQS) API**, one range-request/article | A single request returns the whole 30-day daily history per article, so the **≤ ~6k** distinct contracted articles cost **~6k requests/day** — well inside a daily batch (see rate budget). Targeted, clean JSON, no bzip2/title-matching. **Pageview Complete dumps kept as the scale-out fallback** if the catalogue ever exceeds tens of thousands. | [3][4][8] |
| **Chemistry links** | **D1-backed cache** (lazy + TTL) | Links are a tiny, slow-changing subgraph among contracted articles. Cache stores **both positive and negative** results with `checked_at`; populated lazily and refreshed when stale — no separate storage system. | — |
| **Shared state** | **D1 via REST API** | Single store the whole system reads/writes: contracts in; pageview history, link cache, scores, standings out. No dependency on the backend Worker's uptime. | [7] |

### Data sourcing & rate budget

Pageviews and links are fetched per-article, so the **Wikimedia rate limits**, not Worker limits, are the constraint. They are comfortably met because daily *volume* is tiny and *throughput* is paced (a compliant `User-Agent` with contact info is mandatory and lifts the floor):

| Client | Limit | Time to fetch ~6k articles | Source |
|---|---|---|---|
| Unauth, bare IP | 10 req/min | ~10 h ✗ | [3] |
| **UA-compliant** | **200 req/min** | **~30 min ✓** | [3] |
| Authenticated (token) | 2,000 req/min | ~3 min ✓ | [3] |
| Concurrency (recommended) | ≤ 3 concurrent | — | [3] |

→ Run as an **authenticated, UA-compliant client at ≤3 concurrent**; ~6k requests is ~3–30 min of a batch that has all night. Realistic friends-scale sets are far smaller. Links follow the same budget but are cached, so steady-state fetches are only the new/stale subgraph.

### Authentication

Authentication is **optional headroom, not a hard requirement** — a UA-compliant *unauthenticated* client already gets 200 req/min, enough for ~6k articles. Authenticating raises the ceiling to **2,000 req/min** and gives Wikimedia a contactable identity. The mechanics:

- **Flow — OAuth 2.0 *client credentials*** (non-interactive, server-to-server). Register at `Special:OAuthConsumerRegistration/propose/oauth2` on Meta-Wiki → obtain **client ID + secret** [9].
- **Per run** — POST `grant_type=client_credentials` to `meta.wikimedia.org/w/rest.php/oauth2/access_token` for an access token (valid **4 h**, ≫ a run), then send `Authorization: Bearer <token>` + the mandatory contact-info `User-Agent` on every request [9].
- **Secrets** — client ID + secret live in **GCP Secret Manager**, injected into the Job; never in the repo (same posture as the OIDC keyless CI).
- **Caveat** — the 2,000/min tier requires an **established** account (≈ autoconfirmed: a few days old, ~10+ edits) [3]; a fresh authenticated account still gets only 200/min. Auth most clearly benefits the Action/REST **links** calls; whether it lifts the Analytics **pageviews** endpoint's own tier is unconfirmed (harmless either way).

## Free-tier headroom (why it stays free)

| Resource | Daily batch use (≈) | Always-Free allowance | Source |
|---|---|---|---|
| Cloud Run vCPU-seconds | ~10²–10³ /mo | **180,000 /mo** | [5] |
| Cloud Run GiB-seconds | ~10³ /mo | **360,000 /mo** | [5] |
| Cloud Run requests | ~30–90 /mo | **2,000,000 /mo** | [5] |
| Cloud Scheduler jobs | **3** (daily + Mon snapshot + Sun settle) | **3 free /billing account** | [6] |
| D1 storage (history + caches + scores) | a few MB | **500 MB/db · 5 GB/account** | [7] |

Workload sits at **<1%** of every relevant quota, and storage is one system (D1). GCP has no native spend cap, but the engine holds no precious state, so a budget→detach-billing killswitch is a safe backstop; CI uses GitHub OIDC / Workload Identity (no long-lived key).

## Scope & behaviour (locked)

- **Cadence:** **daily**, run at **~05:00 UTC** to score the last completed UTC day *D* (≈2h after pageview data for *D* is available); idempotent on re-run.
- **Responsibilities:** scoring + standings only. Economy (credits/stipend/pricing/expiry) stays in the backend = single money writer. The engine only *produces* the Normalized-Views history the backend prices from.
- **Scope:** per-league daily standings for **every** league (public play-immediately + private, scored identically) **plus the weekly tournament** (Mon snapshot, Sun settle). Monthly Power Tournament deferred.
- **Interaction:** autonomous + stateless; D1 over REST.
- **Storage — D1 only.** New engine tables: `article_pageviews` (raw + Normalized Views history), `article_links` (link cache incl. negatives, `checked_at`), `scores`, `standings`, and the weekly-tournament snapshot/standings tables. The container is stateless compute in between.

## Consequences

- **Two targets, unambiguously** — Kotlin/JVM differs from V8 on runtime *and* is the first compiled Gradle module; R4 met without a borderline reading, and the build-process story is strengthened.
- **One storage system.** Folding the link cache and pageview history into D1 removes the separate object store an ephemeral-container design would otherwise need.
- **Free** and effectively hard-cappable (killswitch); keyless CI via OIDC.
- **Accepted cost:** no type-sharing with the TS DTOs — the engine re-declares the handful of D1 row shapes it touches as Kotlin data classes.
- **Supersedes** the Requirements doc's §2/§4 daily-at-00:00 and global-tournament framing (see ADR 0001/0002, `docs/domain/scoring-system.md`); `docs/domain/fantawiki-requirements.md` is reconciled to match.

## Sources

1. Cloudflare Workers — Pricing: https://developers.cloudflare.com/workers/platform/pricing/
2. Cloudflare Workers — Limits: https://developers.cloudflare.com/workers/platform/limits/
3. Wikimedia APIs — Rate limits: https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits
4. Wikimedia — Pageview Complete dumps: https://dumps.wikimedia.org/other/pageview_complete/
5. Google Cloud — Always Free features (Cloud Run, Cloud Storage): https://cloud.google.com/free/docs/free-cloud-features
6. Google Cloud — Cloud Scheduler pricing: https://cloud.google.com/scheduler/pricing
7. Cloudflare D1 — Limits: https://developers.cloudflare.com/d1/platform/limits/
8. Wikimedia — Analytics (AQS) pageviews API: https://doc.wikimedia.org/analytics-api/
9. Wikimedia APIs — Authentication (OAuth 2.0 client credentials): https://www.mediawiki.org/wiki/Wikimedia_APIs/Authentication

## Related

- [Scoring & Economy System](../domain/scoring-system.md)
- [Deploy Strategy & Branch Policy](../deployment/deploy-strategy.md)
