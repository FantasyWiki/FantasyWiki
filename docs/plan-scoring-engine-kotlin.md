# Plan — Kotlin Scoring Engine (Component 2)

Status: **proposed**. Detailed design for the nightly scoring engine — the
compute half of the loop whose backend half (Component 1) is already built and
merged. Parent plan and platform rationale: `docs/plan-scoring-engine.md`
(A′ delivery, GitHub Actions host, Kotlin/JVM; ADR 0004).

The backend already exposes the two `/internal` endpoints the engine talks to;
this document covers only the engine.

---

## 1. Scope

The engine is a **stateless nightly batch** with **no formation, schema,
position, or language-calibration logic** — all of that lives in the backend,
which hands the engine flat, pre-resolved data. Adding a new formation (or a new
language `L`) therefore never touches the engine.

```
GET /internal/scoring-inputs?date=D
   → [{ leagueId, teamId, domain, languageScale, articles[], chemistryLinks[[a,b]], formationSnapshot }]
fetch per-article daily views for D             (Wikimedia AQS)            ← the bottleneck
resolve link direction for each pair            (Wikimedia Action API, clustered)
per team:  Σ basePoints(views × L)  +  Σ synergy(pair)   (team cap 20)
POST /internal/performances  { date, results:[{ teamId, points, formationSnapshot }] }
```

The engine only ever talks to two surfaces: the backend (one bearer secret) and
Wikimedia (public). It holds no D1 credential and no persistent state.

---

## 2. DTO refinement — send `languageScale`

The engine needs the Language Scale Factor `L` to normalize views
(`basePoints(views × L)`), and `L` is a per-language **calibration constant** the
backend already owns (`resolveLanguageScale(domain)`, ADR 0002). Add
`languageScale: number` to `ScoringInputDTO` so:

- the engine carries **zero** language/formation configuration — it just fetches
  and does math;
- when the real ADR-0002 `L` calibration lands, **only the backend changes**.

The engine keeps `domain` (it needs it to pick the right Wikipedia host for API
calls); the calibration number itself comes from the backend. Scoring *constants*
that are genuinely scoring math (the base-points curve, `+1.5/+0.5`, the cap 20)
stay in the engine.

---

## 3. Where the cost actually is

**Views are the bottleneck; chemistry is a rounding error.**

- **Views** come from the **AQS per-article** endpoint — single-title, **1 call
  per distinct article, every night**, not batchable and not cacheable (they are
  the daily signal, the whole point is that they change). This is the irreducible
  floor: `N_articles` calls (ADR 0004's ~30 min for ~6k articles is entirely
  this).
- **Chemistry links** are both **batchable** (up to 50 source titles per Action
  API call) and **cacheable** (links change slowly). Resolving only the *actual
  pairs* (not a full N×N matrix) keeps them at worst `O(distinct paired
  articles)`, and in practice a handful of calls.

Design attention goes to the **view fan-out** (dedup + throttle), not chemistry.

| | friends-scale (~150 articles) | ADR ceiling (~6k) |
|---|---|---|
| Views (AQS, 1/article) | ~150 calls — **dominant** | ~6k calls — **dominant** |
| Links (clustered, real pairs) | a handful | a few hundred |

---

## 4. Caching policy

- **Within a run — yes, in-memory, always:**
  - **Dedup view fetches** by `(domain, title)` — one popular article owned by
    many teams/leagues is fetched once. This is the single biggest lever.
  - Reuse link results across teams within the run.
- **Between runs — no (MVP):**
  - Views can't be cached (daily signal), so the expensive half is re-paid every
    run regardless.
  - Links are already cheap, so caching them saves the cheap half.
  - GitHub runners are **ephemeral** (no persistent disk) and, under A′, the
    engine has **no D1 credential** — so a cross-run cache would have to become a
    **backend-owned** `article_links` table + an `/internal` lookup endpoint. That
    is real backend work to cache the part that isn't the bottleneck.
- **Deferred (documented, not built):** if paired-article volume ever hurts, add
  the link cache **behind the backend** (keeping the engine stateless and
  credential-free), per ADR 0004's "D1-backed cache is a later optimization."

---

## 5. Chemistry call clustering

Chemistry pairs form a graph; its natural clusters are **connected components**
(essentially per-team: a team's ~11 articles + ~16–21 links is one small cluster;
teams sharing an article merge).

**The trick — `titles = pltitles = the cluster's article set`.** Within one
component every node is both a potential *source* and a potential *target*, so one
request returns the full directed adjacency inside the cluster:

```
action=query&prop=links&plnamespace=0
  &titles   = c1|c2|…      (the component's nodes as sources)
  &pltitles = c1|c2|…      (the same set, as the target filter)
```

Each source `ci` comes back with which other component members it links to; every
pair `{A,B}` is then classified locally (`A→B` iff `B ∈ links(A)`;
mutual/one-way/none).

**Algorithm:**

1. Collect + **dedup** all chemistry pairs across every team.
2. Build the pair graph, find **connected components** (union-find).
3. **Bin-pack** components into batches with `Σ|C_i| ≤ 50` (the `titles`/`pltitles`
   cap); greedy first-fit. Both `titles` and `pltitles` for a batch are the union
   of its components' nodes, so one number governs the batch: ≤ 50 distinct
   articles.
4. **One API call per batch** → build directed adjacency. Independent components
   sharing a batch don't interfere (nodes in different components share no
   chemistry pair, so any real cross-component link is simply never queried).
5. **Classify every pair locally** and fan the result out to all teams that
   contain it.

**Worked example:** 40 teams, no shared articles → 40 components of ~11 nodes;
~4 per 50-node batch → **~9 calls** for all chemistry (fewer if articles are
shared). Versus ~150+ view calls.

**Edge cases:**
- **Component > 50 nodes** (rare — many teams chained by shared articles): fall
  back *within that component* to the general per-source form (chunk sources ≤ 50,
  `pltitles` = union of just those sources' real partners, chunked ≤ 50).
- **Title reconciliation:** map response titles back through the API's
  `normalized` + `redirects` maps *and* our own canonicalization before matching;
  a `missing` page → no outbound links.
- **Determinism:** sort nodes within a batch for stable, cache-friendly requests.

---

## 6. Technical risks

**(a) Title normalization — the most likely correctness bug.** Three title
sources must reconcile: the stored `articleId`, AQS pageview titles, and
Action-API link titles. Wikipedia treats `_` ≡ space and is case-insensitive on
the first letter. One canonical normalization (underscores→spaces, upper-case
first char, trim) applied on both sides — or synergy silently reads as "no link."
Gets a dedicated, tested `Titles.kt` helper.

**(b) Don't fetch full link lists.** `prop=links` paginates at 500/page; a hub
article has thousands of outbound links. The clustered `pltitles` approach (§5)
keeps every response bounded to the relevant targets — never the full link graph.

---

## 7. Module & build setup

- `settings.gradle.kts`: `include("scoring-engine")` — the repo's **first
  compiled Gradle module** (today Gradle only shells out to npm).
- `gradle/libs.versions.toml`: add `kotlin` (jvm + `plugin.serialization`),
  `kotlinx-coroutines-core`, `kotlinx-serialization-json`.
- `scoring-engine/build.gradle.kts`: `kotlin("jvm")`,
  `kotlin("plugin.serialization")`, `application`
  (mainClass `io.github.fantasywiki.scoring.MainKt`), JVM toolchain **21**,
  `kotlin-test` on JUnit 5.
- Root `build.gradle.kts`: add `:scoring-engine:check` to the `check` task.
- **HTTP:** JDK built-in `java.net.http.HttpClient` (no dependency).
  **JSON:** kotlinx-serialization. **Concurrency:** coroutines + `Semaphore(3)`.
- Package `io.github.fantasywiki.scoring` (matches the repo `group`).

---

## 8. File layout & responsibilities

```
scoring-engine/src/main/kotlin/io/github/fantasywiki/scoring/
  Main.kt            # orchestration: resolve D → GET → fetch → score → POST → exit code
  Config.kt          # BACKEND_URL, INGEST_SECRET, WIKIMEDIA_USER_AGENT, date override, concurrency
  Model.kt           # @Serializable ScoringInput, PerformanceResult, ingest body
  BackendClient.kt   # GET scoring-inputs, POST performances (Bearer, chunked per league)
  Wikimedia.kt       # dailyViews(domain,title,D) [AQS]; resolveChemistry(domain,pairs) [Action API, clustered]
  Titles.kt          # canonical title normalization (risk 6a)
  Scoring.kt         # basePoints(V), articleScore, synergy(level), teamScore, cap 20  — PURE
scoring-engine/src/test/kotlin/io/github/fantasywiki/scoring/
  ScoringTest.kt     # golden vectors (basePoints rungs + synergy cases)
  TitlesTest.kt      # normalization cases
  WikimediaTest.kt   # AQS + Action-API JSON parsing from fixtures; clustering/bin-pack
```

---

## 9. Scoring math (`Scoring.kt`)

Exact port of `model/pricing.ts` `basePoints` — same constants (2 000 zero,
150 000 kink, 50 000 tail, `log2`):

```
basePoints(V) = if (V <= 150_000) max(0, log2(V / 2000))
                else 6.23 + (V - 150_000) / 50_000        // 6.23 = log2(150000/2000)
```

- `articleScore = basePoints(views × L)`; unresolved views → 0 base (+ warn).
- `synergy`: mutual `+1.5`, one-way `+0.5`, none `0`.
- `teamSynergy = min(20, Σ synergy)`.
- `teamScore = Σ articleScore + teamSynergy`.

**Golden-vector cross-check.** A shared `docs/scoring-golden-vectors.json` of
`views → basePoints` (the `scoring-system.md` §3 rungs) plus a few resolved-pair
synergy cases. `ScoringTest.kt` asserts against it; a TS test asserts the same
file against an exported `basePoints` from `model/pricing.ts` (currently private —
export it). This guarantees the two implementations never drift.

---

## 10. Orchestration (`Main.kt`)

1. Resolve `D` = last completed UTC day (override via `--date` / env for backfill).
2. `GET /internal/scoring-inputs?date=D`.
3. Dedup `(domain, title)` across every team's `articles` and all pair endpoints.
4. Concurrently (≤ 3, UA-compliant): fetch each article's daily views for `D`
   (AQS), and resolve chemistry via the clustered Action-API calls (§5).
5. Per team: `Σ basePoints(views × L)` + synergy over its pairs, carry
   `formationSnapshot` verbatim.
6. `POST /internal/performances` chunked per league.
7. Exit non-zero on any hard failure (backend auth/5xx, network); soft-warn on
   per-article view gaps.

---

## 11. Config, errors, idempotency

- **Config (env + args):** `BACKEND_URL`, `SCORING_INGEST_SECRET`,
  `WIKIMEDIA_USER_AGENT` (contact info — mandatory, or Wikimedia 403s), optional
  `--date`.
- **Errors:** view 404 → 0 base + warn; link fetch fail → treat pair as no-link +
  warn; backend auth/5xx → abort non-zero so the GH job goes red.
- **Idempotency:** engine is stateless; the backend upserts on `(teamId, date)` —
  re-runs are safe (matches the retry story).

---

## 12. Testing

- **Golden-vector sync (key):** §9 — the anti-drift guard between the Kotlin and
  TS `basePoints`.
- **`TitlesTest.kt`:** underscores/spaces, first-letter case, redirects, missing.
- **`WikimediaTest.kt`:** AQS + Action-API parsing from fixtures; component
  detection + bin-packing (≤ 50) + local pair classification.
- **`ScoringTest.kt`:** synergy over a set of resolved pairs; team cap 20; 0-view
  handling. Verify a full team against the parent plan's worked example (`21.23`).

---

## 13. Build order (phases)

1. **Skeleton + pure `Scoring.kt` + `ScoringTest.kt`** (golden vectors) — no
   network. Verify the math against the worked example first.
2. **`Titles.kt` + `TitlesTest.kt`** — the normalization helper.
3. **`Wikimedia.kt` + `WikimediaTest.kt`** — AQS parsing + clustered link
   resolution from fixtures; then a live smoke test.
4. **`BackendClient.kt` + `Main.kt`** — wire against the running dev backend with
   `--date`.
5. **Component 3** — the GitHub Actions workflow (two-environment matrix; see
   `docs/plan-scoring-engine.md`).

---

## 14. Open decisions to confirm

1. **Add `languageScale` to `ScoringInputDTO`** (§2) — recommended yes; a one-field
   backend change that keeps the engine free of language config.
2. **JVM 21** + **`kotlin-test`/JUnit 5** (vs Kotest) — recommended as stated.
3. **Backend-side link cache** — deferred, not built for MVP (§4).
