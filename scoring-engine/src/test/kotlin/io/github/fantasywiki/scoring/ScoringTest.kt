package io.github.fantasywiki.scoring

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe

class ScoringTest : StringSpec({
    val tolerance = 1e-9

    "basePoints is clamped to zero at or below the floor" {
        Scoring.basePoints(2_000.0) shouldBe (0.0 plusOrMinus tolerance)
        Scoring.basePoints(1_000.0) shouldBe (0.0 plusOrMinus tolerance)
    }

    "basePoints follows log2 up to the kink" {
        Scoring.basePoints(4_000.0) shouldBe (1.0 plusOrMinus tolerance)
        Scoring.basePoints(150_000.0) shouldBe (6.2288 plusOrMinus 1e-4)
    }

    "basePoints grows linearly past the kink" {
        Scoring.basePoints(200_000.0) shouldBe (7.23 plusOrMinus 1e-2)
    }

    "synergy scores each resolved link direction" {
        Scoring.synergy(ChemistryLink.MUTUAL) shouldBe (1.5 plusOrMinus tolerance)
        Scoring.synergy(ChemistryLink.ONE_WAY) shouldBe (0.5 plusOrMinus tolerance)
        Scoring.synergy(ChemistryLink.NONE) shouldBe (0.0 plusOrMinus tolerance)
    }
})
