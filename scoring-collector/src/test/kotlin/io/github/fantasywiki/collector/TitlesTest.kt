package io.github.fantasywiki.collector

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe

class TitlesTest : StringSpec({
    "treats underscores and spaces as equivalent" {
        Titles.canonical("Lionel_Messi") shouldBe "Lionel Messi"
        Titles.canonical("Lionel Messi") shouldBe "Lionel Messi"
    }

    "upper-cases the first character only" {
        Titles.canonical("lionel Messi") shouldBe "Lionel Messi"
        Titles.canonical("iPhone") shouldBe "IPhone"
    }

    "collapses and trims whitespace" {
        Titles.canonical("  Association   football  ") shouldBe "Association football"
        Titles.canonical("A_B__C") shouldBe "A B C"
    }

    "is idempotent (only the first character is upper-cased, as on Wikipedia)" {
        Titles.canonical("cristiano_ronaldo") shouldBe "Cristiano ronaldo"
        Titles.canonical(Titles.canonical("cristiano_ronaldo")) shouldBe "Cristiano ronaldo"
    }

    "handles empty input" {
        Titles.canonical("") shouldBe ""
        Titles.canonical("   ") shouldBe ""
    }
})
