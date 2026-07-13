# Plan — Nightly Scoring Engine

Status: **proposed**. This document captures the business requirement, the scoring
math, the doc/code discrepancies to resolve first, and the implementation plan for
the nightly point-calculation service.

Canonical sources this plan is derived from:

- `docs/scoring-system.md` — §2 (language normalization), §3 (Base Points),
  §4 (Synergy), §5 (daily/cumulative scoring).
- `docs/adr/0001-base-scoring-model.md`, `docs/adr/0002-language-scale-factor.md`.
- `docs/adr/0004-scoring-engine-platform.md` — platform decision (see "Divergence"
  below: this plan deliberately overrides parts of it).

---

## 1. User story

> **As a** player in a FantasyWiki league,
> **I want** my team to earn points every night based on how many times my articles
> were read on Wikipedia that day — plus bonuses for the chemistry between articles
> I've placed next to each other —
> **so that** I can climb my league's standings and see whether my picks and
> formation are paying off.

### Acceptance criteria

1. When Wikipedia publishes a completed day's pageviews (≈05:00 UTC, ~2h after data
   for day `D` is available), the system scores **every team in every league** —
   public and private alike.
2. Each placed article earns **Base Points** on the "every doubling of views = +1
   point" curve; each **Chemistry Link** between two placed articles adds flat bonus
   points.
3. A team's daily score = Σ of its placed articles' Base Points + its total
   Chemistry, added to the team's running cumulative total.
4. The day is scored against the team's **lineup as it stood that day** (an immutable
   snapshot); standings/leaderboards then reflect the new totals.
5. Re-running the calculation for the same day yields the same result (idempotent),
   and only articles under an **active contract** (owned, not sold/expired) score.
6. Scoring uses **today's daily views** (volatile); contract *pricing* is a separate
   concern on the 30-day average. The engine only *produces* scores — it never
   touches credits/pricing (backend stays the single "money writer", ADR 0004).

*Out of scope for MVP (explicitly deferred in the docs):* weekly tournament & event
bonuses (`scoring-system.md` §7), monthly Power Tournament (ADR 0004).

---

## 2. Math

**Notation:** `v` = an article's raw daily pageviews for day `D`; `L` = the league
language's Language Scale Factor (`en = 1.0`).

**1. Normalized views** (§2) — put every language on one scale:

```
V = v × L
```

**2. Base Points** per article (§3) — continuous curve, returns decimals:

```
             ⎧ max(0, log₂(V / 2000))              if V ≤ 150,000
BasePoints = ⎨
             ⎩ 6.23 + (V − 150,000) / 50,000       if V > 150,000
```

where `6.23 = log₂(150000 / 2000)` (the two pieces meet at the kink).

| Normalized views `V` | Base Points |
|---|---|
| ≤ 2,000 | 0 |
| 2,828 | 0.5 |
| 4,000 | 1.0 |
| 8,000 | 2.0 |
| 16,000 | 3.0 |
| 32,000 | 4.0 |
| 64,000 | 5.0 |
| 128,000 | 6.0 |
| 150,000 (kink) | 6.23 |
| 300,000 | 9.23 |
| 476,000 | 12.75 |

**3. Chemistry / Synergy** (§4) — additive flat points, evaluated **only** over the
`CHEMISTRY_LINKS[schema]` position pairs, and only when *both* positions hold an
article:

```
                 ⎧ +1.5   if A→B and B→A both link on Wikipedia  (mutual / "Excellent")
value(A, B)   =  ⎨ +0.5   if exactly one of A→B, B→A links       (one-way / "Good")
                 ⎩  0     no link, or either slot empty

TeamSynergy   =  min( 20 ,  Σ over schema links value(A, B) )     # optional 20-pt team cap
```

**4. Team daily score** (§5):

```
TeamScore(D)  =  Σ BasePoints(V_article)  +  TeamSynergy       # + EventBonus, deferred = 0
```

**5. Cumulative** (§5):

```
Cumulative    =  previous Cumulative  +  TeamScore(D)
```

### Worked example

A team in an **English** league (`L = 1.0`) on day `D`. Five slots filled (rest empty):

| Position | Article | Raw views `v` | `V = v×1.0` | Base Points |
|---|---|---:|---:|---:|
| ST | *Article α* | 300,000 | 300,000 | 6.23 + (300000−150000)/50000 = **9.23** |
| LW | *Article β* | 64,000 | 64,000 | log₂(64000/2000) = **5.00** |
| CM | *Article γ* | 16,000 | 16,000 | log₂(16000/2000) = **3.00** |
| CLB | *Article δ* | 8,000 | 8,000 | log₂(8000/2000) = **2.00** |
| GK | *Article ε* | 1,500 | 1,500 | ≤2000 → **0.00** |

Base total = 9.23 + 5.00 + 3.00 + 2.00 + 0.00 = **19.23**

Chemistry — of this schema's placed links, suppose:

- ST ↔ LW: α and β link to each other → mutual → **+1.5**
- CLB ↔ GK: δ links to ε but not back → one-way → **+0.5**
- all other placed links: no link → 0

TeamSynergy = 1.5 + 0.5 = **2.0** (under the 20 cap)

```
TeamScore(D) = 19.23 + 2.0 = 21.23
Cumulative   = previous + 21.23
```

*(The GK earns 0 base but still contributes chemistry — the "niche article lives on
synergy" case from §3.)*

---

## 3. Discrepancies to resolve first

Places where the docs and current code disagree, or where the docs leave a gap. Each
would produce **wrong scores** if not resolved before the engine ships. Items 1–3 are
"Phase 0" work; 4 confirms scope; 5 is a documentation follow-up.

| # | Discrepancy | Docs say | Code says | Impact |
|---|---|---|---|---|
| **1** | **Chemistry: additive vs. multiplier** | `scoring-system.md` §4 + ADR 0001: chemistry is **additive flat points** (+1.5 / +0.5), explicitly *"not a multiplier."* | `model/enums.ts` `CHEMISTRY_MULTIPLIER_BY_LEVEL` = `{excellent:1.2, good:1.1, weak:1.05}` — a **multiplier**. | If the engine used the constant, synergy would multiply instead of add — a completely different balance. Engine implements the **additive** model; the multiplier constant is stale (frontend-display leftover) and should be removed or clearly annotated. |
| **2** | **Who computes chemistry** | The engine is the authoritative daily scorer (ADR 0004). | Chemistry *levels* are computed **only client-side** (`backend/src/services/lineup.ts` `emptyChemistryLinks` returns neutral topology; real levels come from `frontend/src/services/teamService.ts`). | No server-side synergy exists today. The engine must own it authoritatively; the frontend value is presentation only and must never feed back into scoring. |
| **3** | **Language Scale Factor is a placeholder** | ADR 0002: `L` is a real per-language constant (en.wp ≈ 13.9× it.wp), **frozen before the first score** in a domain. | `model/pricing.ts` `LANGUAGE_SCALE` is still the placeholder `{en:1.0, it:1.0}`. | en/it score fine now (both 1.0), but any other language — or a *correct* Italian factor — is unimplemented. **Hard blocker** for scoring any domain whose real `L` ≠ 1.0. |
| **4** | **Nobody writes the `performances` table** | The daily engine produces per-team daily scores (ADR 0004). | The `performances` table, `PerformanceService`, and read routes/leaderboard queries **all exist and read it** — but **no code writes to it.** | Confirms the feature is genuinely unbuilt; the read side is ready and waiting. This is the gap the engine fills. |
| **5** | **Platform decision diverges from ADR 0004** | ADR 0004 locks **Kotlin + GCP Cloud Run Jobs + direct D1 writes.** | This plan: Kotlin ✅, but **GitHub Actions** (not Cloud Run) and **POST-through-backend** (not direct D1). | Not a code bug — a deliberate override. Warrants an ADR amendment recording the rationale (free-tier constraint, single-writer boundary). See §5. |

---

## 4. Architecture

Decisions (see §5 for why they diverge from ADR 0004):

- **Delivery (A′):** the engine POSTs precomputed rows to a protected backend
  endpoint; the backend writes D1. Backend stays the single D1 writer; the read path
  is unchanged. The engine holds **no D1 credential** — only a bearer secret.
- **Host/schedule:** GitHub Actions nightly cron.
- **Language:** Kotlin/JVM (plain, not native — the batch is I/O/rate-limit-bound, so
  native buys nothing; static typing was the deciding factor over Python/Clojure).

```
GitHub Actions (nightly cron ~05:00 UTC)
        │
        ▼
 Kotlin/JVM engine (:scoring-engine)
        │  1. GET  /internal/scoring-inputs?date=D   ── backend (Cloudflare Worker)
        │  2. fetch per-article daily views (AQS) ─── Wikimedia
        │     fetch article links (Action API)   ─── Wikimedia  (≤3 concurrent, UA-compliant)
        │  3. compute base points + synergy
        │  4. POST /internal/performances (chunked) ─ backend ──► D1 `performances`
        ▼
 backend reads D1 exactly as today
 (/:id/my-performances, /:id/leaderboard — unchanged)
```

The engine only ever talks to two surfaces: the backend (one bearer secret) and
Wikimedia (public).

---

## 5. Divergence from ADR 0004 (to record as an ADR amendment)

ADR 0004 chose **GCP Cloud Run Jobs + Cloud Scheduler** writing **directly to D1 via
REST**. This plan overrides both, keeping only the Kotlin/JVM choice:

- **Free is a hard constraint.** No free Cloudflare product can host the fetch-heavy
  batch (free Workers cap at 10 ms CPU + 50 subrequests/invocation; the only non-JS
  Cloudflare compute, Containers, is paid). GitHub Actions runs any language for free
  and is *already* the repo's CI home — the fewest new moving parts. Cloud Run's
  free tier also works but adds a whole GCP account/IAM/Artifact Registry surface.
- **Single-writer boundary.** POST-through-backend (A′) keeps the backend the sole D1
  writer and lets it enforce invariants, instead of handing the engine a
  whole-database D1 write token. The Worker only parses a small JSON chunk and
  `await`s `db.batch()` (I/O, not CPU), so the free 10 ms CPU limit is not a concern;
  chunked POSTs keep it flat at any scale.

ADR 0004's autonomy-from-backend rationale is weakened under A′ (the engine now
depends on the backend endpoint regardless), and its scheduling-precision rationale is
neutralized by the batch's ~2h publication buffer (GitHub cron jitter of 10–30 min is
harmless).

---

## 6. Implementation

### Phase 0 — reconcile discrepancies 1–3

- Confirm `CHEMISTRY_MULTIPLIER_BY_LEVEL` is display-only dead code; remove or annotate
  so it can never be wired into scoring. The engine implements the **additive** model.
- Document the engine as the canonical server-side synergy computer (frontend value is
  presentation only).
- Note the `L` placeholder constraint: en/it (both 1.0) are safe; any non-1.0 domain is
  blocked on real `L` calibration (ADR 0002) — a domain's `L` must be frozen before its
  first score.

### Component 1 — Backend: two internal endpoints + write path

New `backend/src/routes/internal.ts`, mounted **outside** the `/api/*` Google-JWT guard,
behind its own service-token middleware (constant-time compare of `Authorization:
Bearer <token>` against `c.env.SCORING_INGEST_SECRET`).

- **`GET /internal/scoring-inputs?date=YYYY-MM-DD`** → for every team across all
  leagues: `{ leagueId, domain, teamId, schema, placements: { position: articleId } }`.
  Backed by a new `ScoringInputService` joining `lineups` + active `contracts`
  (`settled = 0` and `purchaseDate ≤ D < expireDate`), resolving
  `position → contractId → articleId`. Teams with a lineup but no placements are
  included (they score 0, keeping standings advancing).
- **`POST /internal/performances`** → idempotent, chunkable upsert:
  `{ date, results: [{ teamId, points, formation }] }`. New
  `PerformanceRepository.upsertDaily(date, rows)` +
  D1 `INSERT ... ON CONFLICT(teamId, date) DO UPDATE`, wrapped in `db.batch()` chunks.
  Validates: only touches `performances`, rejects unknown `teamId`, `points` finite ≥ 0.
- Mount in `backend/src/index.ts`: `app.route("/internal", internal)` (independent of
  the `/api/*` JWT middleware).
- Config: add `SCORING_INGEST_SECRET` to `backend/.dev.vars`, `wrangler.jsonc`, and
  CI/prod secrets.

### Component 2 — Kotlin/JVM engine module (`:scoring-engine`)

- **Gradle wiring:** `settings.gradle.kts` → `include("scoring-engine")`; add
  Kotlin JVM + `application` plugins via `gradle/libs.versions.toml`; add
  `:scoring-engine:check` to the root `check` task's `dependsOn`. This is the repo's
  first compiled Gradle module.
- **Layout:**
  ```
  scoring-engine/
    build.gradle.kts                     # kotlin("jvm"), application, mainClass
    src/main/kotlin/io/github/fantasywiki/scoring/
      Main.kt                            # inputs → fetch → score → post
      BackendClient.kt                   # GET inputs, POST performances (bearer, chunked)
      WikimediaClient.kt                 # per-article daily views (AQS) + links (Action API), throttled
      Scoring.kt                         # basePoints, articleScore, teamSynergy, teamScore (pure)
      Model.kt                           # ScoringInput, PlacedArticle, PerformanceRow
      Config.kt                          # BACKEND_URL, INGEST_SECRET, date, UA, concurrency
    src/test/kotlin/.../ScoringTest.kt   # golden vectors
  ```
- **Deps (minimal):** `kotlinx-coroutines` (throttled fan-out, `Semaphore(3)`),
  `kotlinx-serialization-json`, JDK built-in `java.net.http.HttpClient`.
- **Logic (`Main.kt`):** resolve `D` = last completed UTC day (overridable for
  backfill) → GET inputs → dedup `(domain, articleTitle)` → concurrently (≤3) fetch
  each article's daily views for `D` and outbound links → per team compute
  `Σ basePoints(views × L) + synergy` → POST results in chunks (per league) → exit
  non-zero on hard failure.
- **Edge handling:** unresolved views → 0 base + warning; empty slots → 0; synergy
  capped at 20/team.
- **Link cache:** in-memory per run for MVP (friends-scale = dozens of distinct
  articles). ADR 0004's D1-backed cache is a later optimization and, under A′, would
  live behind a backend endpoint (not in the engine).

### Component 3 — GitHub Actions workflow

`.github/workflows/scoring.yml`:

```yaml
on:
  schedule: [{ cron: "0 5 * * *" }]   # ~2h after AQS publishes day D
  workflow_dispatch: { inputs: { date: { required: false } } }  # manual backfill
jobs:
  score:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
      - run: ./gradlew :scoring-engine:run --args="..."
        env:
          BACKEND_URL: ${{ secrets.SCORING_BACKEND_URL }}
          SCORING_INGEST_SECRET: ${{ secrets.SCORING_INGEST_SECRET }}
          WIKIMEDIA_USER_AGENT: ${{ secrets.WIKIMEDIA_UA }}
```

- Cron jitter (GH can delay 10–30 min) is absorbed by the ~2h publication buffer.
- Wikimedia OAuth (2000 req/min) is optional headroom; UA-compliant unauth (200/min)
  covers friends-scale. Secrets live in GH repo secrets.

### Testing

- **Golden-vector sync (key):** shared `docs/scoring-golden-vectors.json` of
  `views → basePoints` (the §3 table rows) and a few `(schema, placements, links) →
  synergy` cases. Both the Kotlin `ScoringTest` and a TS test assert against it,
  preventing the two `basePoints` implementations from drifting. Export `basePoints`
  from `model/pricing.ts` (currently private) for the TS assertion.
- **Backend integration tests** (`@cloudflare/vitest-pool-workers`): POST upserts +
  idempotency; auth rejects bad/missing token; GET resolves placements and excludes
  settled/expired contracts; end-to-end `/:id/leaderboard` and `/:id/my-performances`
  reflect written rows.
- **Engine unit tests:** Wikimedia client parsing (fixture JSON), synergy over each of
  the 5 schemas, throttling.

---

## 7. Dependencies, risks & deferrals

| Item | Status / action |
|---|---|
| `L` per language still a placeholder | Engine mirrors `{en:1,it:1}`. Non-1.0 domains blocked on ADR 0002 calibration; a domain's `L` must be frozen before its first score. |
| Synergy multiplier discrepancy | Phase 0. |
| Chemistry link cache | In-memory per run for MVP; D1-backed (behind backend) only if volume grows. |
| Weekly tournament / events | Deferred (§7, ADR 0004). |
| Free-tier CPU headroom | Chunked POSTs keep it inside free 10 ms; $5/mo Workers Paid is optional insurance at large scale. |

---

## 8. Suggested build order

1. **Phase 0** — reconcile discrepancies 1–3; write ADR amendment for the §5 divergence.
2. **Backend** — `internal.ts` (both endpoints + token middleware), `upsertDaily`,
   `ScoringInputService`, secret wiring, integration tests (testable via curl before
   the engine exists).
3. **Engine** — Gradle module + `Scoring.kt` + golden-vector test (pure logic, no network).
4. **Engine** — Wikimedia + backend clients, `Main.kt`, run locally against the dev
   backend with a `--date` override.
5. **GitHub Actions** — workflow + secrets; dry-run via `workflow_dispatch`; enable cron.
