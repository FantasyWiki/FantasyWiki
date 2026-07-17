package io.github.fantasywiki.collector

import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.DefaultRequest
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.http.HttpHeaders
import io.ktor.serialization.kotlinx.json.json
import java.time.Instant
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json

/**
 * Minimal structured stderr logging for the nightly job — no logging framework
 * to keep this CLI dependency-light. Each line is `ISO-8601 LEVEL message`, so CI
 * log output is timestamped and greppable by level.
 */
private fun log(level: String, message: String) = System.err.println("${Instant.now()} $level $message")

private fun info(message: String) = log("INFO", message)

/**
 * Nightly entry point: resolve config → GET the day's inputs → fetch Wikimedia
 * signals → POST the raw results the backend scores. Any hard failure (bad
 * config, backend auth/5xx, network) propagates and exits non-zero so the CI job
 * goes red; a single missing article's views is a soft warning, not a failure.
 */
fun main(args: Array<String>) {
    val config = Config.fromEnvAndArgs(args)
    info(
        "collector starting: date=${config.date} backend=${config.backendUrl} concurrency=${config.concurrency}",
    )

    val http = HttpClient(CIO) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
        install(DefaultRequest) {
            header(HttpHeaders.UserAgent, config.userAgent)
        }
    }

    http.use { client ->
        runBlocking {
            val backend = BackendClient(client, config.backendUrl, config.ingestSecret)
            val wikimedia = WikimediaClient(client)

            val date = config.date.toString()

            info("fetching scoring inputs for $date")
            val inputs = backend.getScoringInputs(date)
            info("got ${inputs.size} teams to score")

            info("collecting Wikimedia signals")
            val results = Collector.collect(inputs, wikimedia, config.concurrency, config.date) { message ->
                log("WARN", message)
            }

            info("posting ${results.size} performances for $date")
            backend.postPerformances(date, results)

            info("done: scored ${results.size} teams for $date")
            println("Scored ${results.size} teams for $date")
        }
    }
}
