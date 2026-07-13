package io.github.fantasywiki.scoring

import kotlin.math.log2
import kotlin.math.max

/** Directionality of a resolved chemistry link between two contracted articles. */
enum class ChemistryLink {
    /** Both articles link to each other. */
    MUTUAL,

    /** Exactly one article links to the other. */
    ONE_WAY,

    /** Neither article links to the other. */
    NONE,
}

/**
 * Pure scoring math for the nightly scoring engine.
 *
 * Placeholder stub of the base-points curve and chemistry synergy described in
 * `docs/plan-scoring-engine-kotlin.md` (§9). It exists so the code-quality and
 * coverage tooling has real, tested code to run against; the full engine lands
 * in a later phase.
 */
object Scoring {
    private const val ZERO_THRESHOLD = 2_000.0
    private const val KINK_VIEWS = 150_000.0
    private const val TAIL_DIVISOR = 50_000.0
    private const val KINK_POINTS = 6.23
    private const val MUTUAL_BONUS = 1.5
    private const val ONE_WAY_BONUS = 0.5

    /** Base points awarded for a single article's normalized daily views [views]. */
    fun basePoints(views: Double): Double = if (views <= KINK_VIEWS) {
        max(0.0, log2(views / ZERO_THRESHOLD))
    } else {
        KINK_POINTS + (views - KINK_VIEWS) / TAIL_DIVISOR
    }

    /** Chemistry synergy contributed by a single resolved [link] between two articles. */
    fun synergy(link: ChemistryLink): Double = when (link) {
        ChemistryLink.MUTUAL -> MUTUAL_BONUS
        ChemistryLink.ONE_WAY -> ONE_WAY_BONUS
        ChemistryLink.NONE -> 0.0
    }
}
