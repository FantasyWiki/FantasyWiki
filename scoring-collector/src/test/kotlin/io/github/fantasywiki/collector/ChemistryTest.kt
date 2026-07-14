package io.github.fantasywiki.collector

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe

class ChemistryTest : StringSpec({
    "mutual links are Excellent" {
        Chemistry.classify(sourceLinksToTarget = true, targetLinksToSource = true) shouldBe
            ChemistryLevel.EXCELLENT
    }

    "a one-way link (either direction) is Good" {
        Chemistry.classify(sourceLinksToTarget = true, targetLinksToSource = false) shouldBe
            ChemistryLevel.GOOD
        Chemistry.classify(sourceLinksToTarget = false, targetLinksToSource = true) shouldBe
            ChemistryLevel.GOOD
    }

    "no link is Weak" {
        Chemistry.classify(sourceLinksToTarget = false, targetLinksToSource = false) shouldBe
            ChemistryLevel.WEAK
    }
})
