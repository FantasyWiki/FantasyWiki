package io.github.fantasywiki.collector

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.TextContent
import kotlinx.serialization.json.Json

class BackendClientTest : StringSpec({
    "getScoringInputs sends the bearer token + date and parses the response" {
        var auth: String? = null
        var dateParam: String? = null
        val client = mockJsonClient { request ->
            auth = request.headers["Authorization"]
            dateParam = request.url.parameters["date"]
            respondJson(
                """[{"leagueId":"l1","teamId":"t1","domain":"en",
                   "articles":["A"],"chemistryLinks":[["A","B"]],"formationSnapshot":"{}"}]""",
            )
        }

        val inputs = BackendClient(client, "https://backend.example", "secret")
            .getScoringInputs("2026-06-07")

        auth shouldBe "Bearer secret"
        dateParam shouldBe "2026-06-07"
        inputs.size shouldBe 1
        inputs[0].teamId shouldBe "t1"
        inputs[0].chemistryLinks shouldContainExactly listOf(listOf("A", "B"))
    }

    "getScoringInputs throws on a non-success status" {
        val client = mockJsonClient { respondJson("unauthorized", status = HttpStatusCode.Unauthorized) }
        shouldThrow<IllegalArgumentException> {
            BackendClient(client, "https://backend.example", "secret").getScoringInputs("2026-06-07")
        }
    }

    "postPerformances chunks large result sets across multiple requests" {
        var requestCount = 0
        var totalPosted = 0
        val client = mockJsonClient { request ->
            requestCount += 1
            val body = (request.body as TextContent).text
            val ingest = Json.decodeFromString<PerformanceIngest>(body)
            totalPosted += ingest.results.size
            respondJson("""{"written":${ingest.results.size}}""")
        }
        val results = (1..150).map {
            PerformanceResult("t$it", listOf(1_000L), emptyList(), "{}")
        }

        BackendClient(client, "https://backend.example", "secret")
            .postPerformances("2026-06-07", results)

        requestCount shouldBe 2 // 100 + 50 at CHUNK_SIZE = 100
        totalPosted shouldBe 150
    }
})
