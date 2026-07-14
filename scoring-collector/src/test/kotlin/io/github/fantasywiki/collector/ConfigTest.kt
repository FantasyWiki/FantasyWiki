package io.github.fantasywiki.collector

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import java.time.LocalDate

class ConfigTest : StringSpec({
    val env = mapOf(
        "BACKEND_URL" to "https://backend.example/",
        "SCORING_INGEST_SECRET" to "secret",
        "WIKIMEDIA_USER_AGENT" to "FantasyWiki/1.0 (contact@example)",
    )

    "defaults date to the last completed UTC day" {
        val config = Config.fromEnvAndArgs(emptyArray(), env::get, LocalDate.of(2026, 7, 14))
        config.date shouldBe LocalDate.of(2026, 7, 13)
    }

    "trims a trailing slash off the backend URL" {
        Config.fromEnvAndArgs(emptyArray(), env::get).backendUrl shouldBe "https://backend.example"
    }

    "honours a --date override for backfill" {
        val config = Config.fromEnvAndArgs(arrayOf("--date=2026-01-15"), env::get)
        config.date shouldBe LocalDate.of(2026, 1, 15)
    }

    "fails fast when a required variable is missing" {
        shouldThrow<IllegalStateException> {
            Config.fromEnvAndArgs(emptyArray(), env = { null })
        }
    }
})
