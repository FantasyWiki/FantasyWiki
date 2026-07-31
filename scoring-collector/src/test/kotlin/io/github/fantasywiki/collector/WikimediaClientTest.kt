package io.github.fantasywiki.collector

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.inspectors.forAll
import io.kotest.matchers.ints.shouldBeLessThanOrEqual
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import java.time.LocalDate

class WikimediaClientTest : StringSpec({
    val date = LocalDate.of(2026, 6, 7)

    "dailyViews returns the day's view count" {
        val client = mockJsonClient { respondJson("""{"items":[{"views":12345}]}""") }
        WikimediaClient(client).dailyViews("en", "Lionel Messi", date) shouldBe 12_345L
    }

    "dailyViews builds a single-day AQS URL with an underscored title" {
        var seen = ""
        val client = mockJsonClient { request ->
            seen = request.url.toString()
            respondJson("""{"items":[{"views":1}]}""")
        }
        WikimediaClient(client).dailyViews("en", "Association football", date)
        seen shouldContain "/per-article/en.wikipedia/all-access/user/Association_football/daily/20260607/20260607"
    }

    "dailyViews returns null when the article has no data (404)" {
        val client = mockJsonClient { respondJson("", status = io.ktor.http.HttpStatusCode.NotFound) }
        WikimediaClient(client).dailyViews("en", "Nonexistent", date) shouldBe null
    }

    "dailyViews returns null on an empty items array" {
        val client = mockJsonClient { respondJson("""{"items":[]}""") }
        WikimediaClient(client).dailyViews("en", "Nonexistent", date) shouldBe null
    }

    "dailyViews waits out a rate limit and retries" {
        var attempts = 0
        val client = retryingMockClient {
            attempts++
            if (attempts == 1) {
                // AQS answers errors with problem+json, which parses into an empty
                // AqsResponse — the shape that used to read as "no data".
                respondJson(
                    """{"detail":"rate limit exceeded","status":429,"title":"Too Many Requests"}""",
                    status = io.ktor.http.HttpStatusCode.TooManyRequests,
                )
            } else {
                respondJson("""{"items":[{"views":4242}]}""")
            }
        }

        WikimediaClient(client).dailyViews("en", "Lionel Messi", date) shouldBe 4242L
        attempts shouldBe 2
    }

    "dailyViews fails loudly when the rate limit outlasts every retry" {
        val client = retryingMockClient {
            respondJson(
                """{"detail":"rate limit exceeded","status":429,"title":"Too Many Requests"}""",
                status = io.ktor.http.HttpStatusCode.TooManyRequests,
            )
        }

        // Never 0 views: a throttled article must abort the run, not score zero.
        shouldThrow<IllegalArgumentException> {
            WikimediaClient(client).dailyViews("en", "Lionel Messi", date)
        }
    }

    "outboundLinksAmong returns the whole directed graph from one request" {
        var requests = 0
        var seenTitles = ""
        val client = mockJsonClient { request ->
            requests++
            seenTitles = request.url.parameters["titles"].orEmpty()
            respondJson(
                """{"query":{"pages":[
                   {"title":"Lionel Messi","links":[{"ns":0,"title":"Cristiano Ronaldo"}]},
                   {"title":"Cristiano Ronaldo","links":[{"ns":0,"title":"Lionel Messi"}]},
                   {"title":"Diego Maradona","links":[]}]}}""",
            )
        }

        val graph = WikimediaClient(client).outboundLinksAmong(
            "en",
            listOf("Lionel_Messi", "Cristiano Ronaldo", "Diego Maradona"),
        )

        requests shouldBe 1
        // Every article rides in the one request, canonicalized and pipe-joined.
        seenTitles shouldBe "Cristiano Ronaldo|Diego Maradona|Lionel Messi"
        graph shouldBe mapOf(
            "Lionel Messi" to setOf("Cristiano Ronaldo"),
            "Cristiano Ronaldo" to setOf("Lionel Messi"),
        )
    }

    "outboundLinksAmong omits missing pages" {
        val client = mockJsonClient {
            respondJson(
                """{"query":{"pages":[
                   {"title":"Nope","missing":true},
                   {"title":"Real","links":[{"ns":0,"title":"Other"}]}]}}""",
            )
        }
        WikimediaClient(client).outboundLinksAmong("en", listOf("Nope", "Real", "Other")) shouldBe
            mapOf("Real" to setOf("Other"))
    }

    "outboundLinksAmong makes no request for fewer than two articles" {
        var called = false
        val client = mockJsonClient {
            called = true
            respondJson("{}")
        }
        WikimediaClient(client).outboundLinksAmong("en", listOf("Isolated")) shouldBe emptyMap()
        called shouldBe false
    }

    "outboundLinksAmong follows plcontinue so a truncated page keeps its links" {
        var requests = 0
        val client = mockJsonClient { request ->
            requests++
            if (request.url.parameters["plcontinue"] == null) {
                respondJson(
                    """{"continue":{"plcontinue":"736|0|B"},
                       "query":{"pages":[{"title":"A","links":[{"ns":0,"title":"B"}]}]}}""",
                )
            } else {
                respondJson(
                    """{"query":{"pages":[
                       {"title":"A","links":[{"ns":0,"title":"C"}]},
                       {"title":"B","links":[{"ns":0,"title":"A"}]}]}}""",
                )
            }
        }

        val graph = WikimediaClient(client).outboundLinksAmong("en", listOf("A", "B", "C"))

        requests shouldBe 2
        // The second page of A's links is merged in, not overwritten or dropped.
        graph shouldBe mapOf("A" to setOf("B", "C"), "B" to setOf("A"))
    }

    "outboundLinksAmong stays inside the 50-title cap for a large pool" {
        val requests = mutableListOf<Pair<Int, Int>>()
        val client = mockJsonClient { request ->
            requests.add(
                request.url.parameters["titles"].orEmpty().split("|").size to
                    request.url.parameters["pltitles"].orEmpty().split("|").size,
            )
            respondJson("""{"query":{"pages":[]}}""")
        }

        // 60 articles → two chunks a side, so the block grid is 2×2 requests.
        WikimediaClient(client).outboundLinksAmong("en", (1..60).map { "Article $it" })

        requests.size shouldBe 4
        requests.forAll { (titles, candidates) ->
            titles shouldBeLessThanOrEqual 50
            candidates shouldBeLessThanOrEqual 50
        }
    }
})
