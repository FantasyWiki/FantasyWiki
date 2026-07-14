package io.github.fantasywiki.collector

import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.DefaultRequest
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.http.HttpHeaders
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json

/**
 * Nightly entry point: resolve config → GET the day's inputs → fetch Wikimedia
 * signals → POST the raw results the backend scores. Any hard failure (bad
 * config, backend auth/5xx, network) propagates and exits non-zero so the CI job
 * goes red; a single missing article's views is a soft warning, not a failure.
 */
fun main(args: Array<String>) {
    val config = Config.fromEnvAndArgs(args)

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
            val inputs = backend.getScoringInputs(date)
            val results = Collector.collect(inputs, wikimedia, config.concurrency, config.date) { message ->
                System.err.println("WARN: $message")
            }
            backend.postPerformances(date, results)

            println("Scored ${results.size} teams for $date")
        }
    }
}
