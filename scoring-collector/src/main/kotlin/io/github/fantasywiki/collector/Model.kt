package io.github.fantasywiki.collector

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * The resolved direction of a Chemistry Link between two placed articles, derived
 * from the Wikipedia link graph. Wire form matches the backend's canonical
 * `ChemistryLevel` (`model/enums.ts`): `excellent` = mutual link, `good` = one-way,
 * `weak` = both placed but no link. `empty` (a slot unfilled) never originates
 * here — the backend drops pairs with an empty endpoint before sending them.
 */
@Serializable
enum class ChemistryLevel {
    /** Mutual link — both articles link to each other (+1.5). */
    @SerialName("excellent")
    EXCELLENT,

    /** One-way link — exactly one article links to the other (+0.5). */
    @SerialName("good")
    GOOD,

    /** Both placed but no link between them (0). */
    @SerialName("weak")
    WEAK,

    /** A slot is unfilled (0) — never produced here; included to mirror the backend enum. */
    @SerialName("empty")
    EMPTY,
}

/**
 * One team's daily scoring inputs from GET /internal/scoring-inputs — the JVM-side
 * mirror of `dto/scoring.ts` `ScoringInputDTO` (kept in lockstep by hand; ADR 0004
 * accepts no type-sharing across runtimes). Free of any formation/schema concepts:
 * the backend already resolved the schema's Chemistry Links to concrete article
 * pairs in [chemistryLinks].
 */
@Serializable
data class ScoringInput(
    /** The league this team plays in. */
    val leagueId: String,
    /** The team being scored. */
    val teamId: String,
    /** League language domain (e.g. "en") — picks the Wikipedia host to query. */
    val domain: String,
    /** Placed, active article titles to fetch daily views for. */
    val articles: List<String>,
    /** Article pairs to evaluate, as `[[a, b], ...]` (both endpoints already placed). */
    val chemistryLinks: List<List<String>>,
    /** Opaque formation snapshot, echoed back verbatim in the result. */
    val formationSnapshot: String,
)

/**
 * One team's raw daily signals sent to POST /internal/performances — the mirror of
 * `dto/scoring.ts` `PerformanceResultDTO`. The collector sends *facts it fetched*,
 * never a computed score: the backend owns all scoring math.
 */
@Serializable
data class PerformanceResult(
    /** The team these signals belong to. */
    val teamId: String,
    /** Placed articles' raw daily views (one per placed article, any order). */
    val articleViews: List<Long>,
    /** Resolved level for each [ScoringInput.chemistryLinks] pair, in the same order. */
    val chemistryLevels: List<ChemistryLevel>,
    /** The opaque formation snapshot echoed back verbatim from the matching input. */
    val formationSnapshot: String,
)

/** Body of POST /internal/performances — mirror of `dto/scoring.ts` `PerformanceIngestDTO`. */
@Serializable
data class PerformanceIngest(
    /** Scored calendar day, `YYYY-MM-DD`. */
    val date: String,
    /** The per-team raw signals in this chunk. */
    val results: List<PerformanceResult>,
)
