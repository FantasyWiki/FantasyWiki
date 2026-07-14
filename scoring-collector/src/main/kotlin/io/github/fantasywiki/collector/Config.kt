package io.github.fantasywiki.collector

import java.time.LocalDate
import java.time.ZoneOffset

/**
 * Runtime configuration, from environment + args. Secrets and endpoints come from
 * the environment (per-GitHub-Environment in CI); [date] defaults to the last
 * completed UTC day but is overridable via `--date=YYYY-MM-DD` for backfill.
 */
data class Config(
    /** Base URL of the backend Worker exposing the `/internal` endpoints. */
    val backendUrl: String,
    /** Shared bearer secret authenticating the `/internal` calls. */
    val ingestSecret: String,
    /** Contact info — Wikimedia 403s requests without a descriptive User-Agent. */
    val userAgent: String,
    val date: LocalDate,
    /** Max concurrent Wikimedia requests (UA-compliant unauthenticated headroom). */
    val concurrency: Int = 3,
) {
    /** Builds [Config] from environment variables and CLI args. */
    companion object {
        /**
         * Reads required env vars (`BACKEND_URL`, `SCORING_INGEST_SECRET`,
         * `WIKIMEDIA_USER_AGENT`) and resolves the scored [date] from `--date=` or
         * the last completed UTC day. [env] and [today] are injectable for testing.
         */
        fun fromEnvAndArgs(
            args: Array<String>,
            env: (String) -> String? = System::getenv,
            today: LocalDate = LocalDate.now(ZoneOffset.UTC),
        ): Config {
            fun required(name: String): String = env(name)?.takeIf { it.isNotBlank() }
                ?: error("Missing required environment variable: $name")

            val dateArg = args.firstOrNull { it.startsWith("--date=") }?.substringAfter("=")
            val date = when {
                !dateArg.isNullOrBlank() -> LocalDate.parse(dateArg)
                else -> today.minusDays(1)
            }

            return Config(
                backendUrl = required("BACKEND_URL").trimEnd('/'),
                ingestSecret = required("SCORING_INGEST_SECRET"),
                userAgent = required("WIKIMEDIA_USER_AGENT"),
                date = date,
            )
        }
    }
}
