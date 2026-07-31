package io.github.fantasywiki.collector

import io.ktor.client.HttpClientConfig
import io.ktor.client.plugins.DefaultRequest
import io.ktor.client.plugins.HttpRequestRetry
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

/** How long to wait out a rate-limit before retrying, when the server names no `Retry-After`. */
const val RATE_LIMIT_DELAY_MILLIS = 60_000L

/** Attempts after the first before a request is allowed to fail the run. */
private const val MAX_RETRIES = 3

/** Jitter on the retry delay, so a throttled fan-out does not resume in lockstep. */
private const val RETRY_JITTER_MILLIS = 1_000L

/**
 * The plugin stack every collector HTTP client shares — production and tests
 * alike, so the retry behaviour under test is the behaviour that ships.
 *
 * **Rate limits.** A UA-compliant unauthenticated client gets 200 requests a
 * minute. `Semaphore(concurrency)` caps how many requests are *in flight*, which
 * is not the same thing: three concurrent requests at ~150 ms each sustain far
 * more than 200/min, so a large enough article pool will eventually be
 * throttled. When that happens Wikimedia answers 429 and this waits
 * [RATE_LIMIT_DELAY_MILLIS] (or `Retry-After`, when the response names a longer
 * one) before trying again.
 *
 * Server errors get the same treatment: without a retry they would surface as a
 * hard failure now that [WikimediaClient] no longer swallows non-2xx responses.
 *
 * @param userAgent Wikimedia requires a descriptive, contactable UA — see [Config].
 * @param rateLimitDelayMillis overridable so tests need not really sleep a minute.
 */
fun HttpClientConfig<*>.collectorHttpDefaults(
    userAgent: String,
    rateLimitDelayMillis: Long = RATE_LIMIT_DELAY_MILLIS,
) {
    install(ContentNegotiation) {
        json(Json { ignoreUnknownKeys = true })
    }
    install(DefaultRequest) {
        header(HttpHeaders.UserAgent, userAgent)
    }
    install(HttpRequestRetry) {
        retryIf(maxRetries = MAX_RETRIES) { _, response ->
            response.status == HttpStatusCode.TooManyRequests ||
                response.status.value >= HttpStatusCode.InternalServerError.value
        }
        constantDelay(
            millis = rateLimitDelayMillis,
            randomizationMs = RETRY_JITTER_MILLIS,
            respectRetryAfterHeader = true,
        )
    }
}
