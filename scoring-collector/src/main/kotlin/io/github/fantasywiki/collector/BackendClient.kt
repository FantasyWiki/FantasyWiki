package io.github.fantasywiki.collector

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess

/**
 * Talks to the backend's two `/internal` endpoints — the only privileged surface
 * the collector touches (one bearer secret, no D1 credential; ADR 0004's
 * single-writer boundary). The backend, not this client, computes scores.
 */
class BackendClient(private val http: HttpClient, private val backendUrl: String, private val ingestSecret: String) {
    private companion object {
        /** Keep each POST's D1 batch bounded; the endpoint is idempotent so chunking is safe. */
        const val CHUNK_SIZE = 100
    }

    /** The day's scorable teams (GET /internal/scoring-inputs). */
    suspend fun getScoringInputs(date: String): List<ScoringInput> {
        val response = http.get("$backendUrl/internal/scoring-inputs") {
            bearerAuth(ingestSecret)
            parameter("date", date)
        }
        require(response.status.isSuccess()) {
            "GET scoring-inputs failed: ${response.status} ${response.bodyAsText()}"
        }
        return response.body()
    }

    /** Ingest the computed-upstream raw signals (POST /internal/performances), chunked. */
    suspend fun postPerformances(date: String, results: List<PerformanceResult>) {
        for (chunk in results.chunked(CHUNK_SIZE)) {
            val response = http.post("$backendUrl/internal/performances") {
                bearerAuth(ingestSecret)
                contentType(ContentType.Application.Json)
                setBody(PerformanceIngest(date, chunk))
            }
            require(response.status.isSuccess()) {
                "POST performances failed: ${response.status} ${response.bodyAsText()}"
            }
        }
    }
}
