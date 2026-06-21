# Daily scoring as a separate Go batch service, not a Worker

The daily scoring engine is built as a **standalone Go service that runs as a scheduled container**, autonomous from the Cloudflare backend: it reads contracts and writes scores/standings to D1 over the REST API, sources pageviews from Wikimedia's bulk dumps, and computes base points + chemistry + the weekly tournament. We chose this over extending the existing Worker because scoring is a different *workload class* — long-running, scheduled, heavy I/O fan-out — that the edge request/response runtime cannot host. It also gives SPE its second target platform (a JVM/native runtime distinct from the all-V8/JS frontend+backend) for free, but the architecture is correct independent of the exam.

## The constraint that shaped it

A daily batch that fans out across *every contracted article* collides with two hard limits at once: Cloudflare Workers cap subrequests (~50 free / 1000 paid) and CPU time per invocation, and the 2026 Wikimedia API limits are punishing (unauth `<5 req/s`; auth `10 req/s` & `5,000/hr`; anon `api.wikimedia.org` gateway `500/hr`; 429 + `Retry-After`; mandatory contact-info User-Agent). Per-article fetching from the edge is impossible both ways. So the engine must (a) live outside the Worker and (b) *not* fetch pageviews per article.

## Locked decisions

- **Responsibilities — scoring + standings only.** Economy mutations (credits, stipend, expiry) stay in the backend, keeping a single writer for money.
- **Scope — per-league daily standings for every league** (the public play-immediately league + private leagues, scored identically) **plus the weekly tournament** (Monday portfolio snapshot, Sunday settlement). Monthly Power Tournament deferred.
- **Interaction — autonomous and stateless.** Reads contracts / writes scores+standings to **D1 via the Cloudflare D1 REST API**; no dependency on the backend Worker's uptime.
- **Runtime — Go.** Near-instant cold start (cheap on per-100ms billing), goroutine fan-out for I/O, tiny distroless image, minimal attack surface. The runner-up was Kotlin + GraalVM native; plain JVM was rejected because warmup fights the boot-run-exit shape.
- **Pageviews — bulk dumps, not the API.** The **Pageview Complete** `-user` daily file (`dumps.wikimedia.org/other/pageview_complete/`, per-article daily totals, bzip2) is stream-filtered to contracted titles each run — zero API calls, scales regardless of article count. Day *D*'s file publishes ~02:15–03:00 UTC on *D+1*, so the daily run is scheduled at **~05:00 UTC on D+1** (≈2h buffer) with a file-exists/date guard and retry — not the spec's 00:00 UTC.
- **Chemistry links — cached authenticated API.** Links are needed only between contracted articles and change slowly, so they're fetched with an authenticated, throttled client and cached; each run delta-fetches only missing/stale entries (TTL ~14d).
- **Hosting — GCP Cloud Run Jobs + Cloud Scheduler.** Run-to-completion containers on managed scheduling (no cluster); 3 free scheduler jobs map to daily + Monday snapshot + Sunday settle.

## Storage split

- **D1 (Cloudflare)** — shared domain state the whole system reads: contracts, scores, standings.
- **GCS bucket (GCP, US region, Always-Free)** — the engine-private link cache. Per run: load the manifest at boot, diff against active contracts, delta-fetch, save before exit. Pruned of dropped contracts.
- **Container** — stateless compute in between; statelessness of the *container* never meant statelessness of the *system*.

## Consequences

- **Free and effectively hard-capped.** The workload sits at <1% of every relevant GCP Always-Free quota (Cloud Run, Cloud Scheduler, GCS). GCP has no native spend cap, but because the engine holds no precious state, the budget→detach-billing killswitch is a safe backstop, and CI authenticates via GitHub OIDC / Workload Identity (no long-lived key to leak into the public repo).
- **Two targets, unambiguously.** Go differs from the Node/V8 stack on both runtime *and* build system, so the SPE "2+ platforms" criterion is met without relying on a borderline reading.
- **A second store to operate** (GCS) and **no type sharing with the TS DTOs** — accepted costs; Fork 3's autonomy already shrank the duplication to the handful of D1 row shapes the engine touches.
- **The Requirements doc's §2/§4 daily-at-00:00 and global-tournament framing are superseded here** (see ADR 0001/0002 and `docs/scoring-system.md`); reconcile the stale `FantaWiki-Requirements.md` to match.
