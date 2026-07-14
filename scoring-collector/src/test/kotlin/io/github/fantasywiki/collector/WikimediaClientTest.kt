package io.github.fantasywiki.collector

import io.kotest.core.spec.style.StringSpec
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

    "outboundLinks returns only candidates the source links to, canonicalized" {
        val client = mockJsonClient {
            respondJson(
                """{"query":{"pages":[{"title":"Lionel Messi",
                   "links":[{"ns":0,"title":"Cristiano Ronaldo"}]}]}}""",
            )
        }
        WikimediaClient(client).outboundLinks(
            "en",
            "Lionel Messi",
            listOf("cristiano_ronaldo", "Diego Maradona"),
        ) shouldBe setOf("Cristiano Ronaldo")
    }

    "outboundLinks is empty for a missing page" {
        val client = mockJsonClient {
            respondJson("""{"query":{"pages":[{"title":"Nope","missing":true}]}}""")
        }
        WikimediaClient(client).outboundLinks("en", "Nope", listOf("Anything")) shouldBe emptySet()
    }

    "outboundLinks makes no request when there are no candidates" {
        var called = false
        val client = mockJsonClient {
            called = true
            respondJson("{}")
        }
        WikimediaClient(client).outboundLinks("en", "Isolated", emptyList()) shouldBe emptySet()
        called shouldBe false
    }
})
