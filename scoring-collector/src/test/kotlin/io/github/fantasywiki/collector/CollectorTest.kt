package io.github.fantasywiki.collector

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.ktor.client.HttpClient
import io.ktor.http.HttpStatusCode
import java.time.LocalDate

/**
 * A scripted Wikimedia backend: AQS returns per-title daily views, the Action API
 * returns per-source outbound links. Both branch on the request so a full
 * collection run can be exercised end-to-end against a Ktor MockEngine.
 */
private fun wikimediaStub(views: Map<String, Long>, links: Map<String, List<String>>): HttpClient =
    mockJsonClient { request ->
        val url = request.url
        when {
            url.host == "wikimedia.org" -> {
                val title = Titles.canonical(url.encodedPath.substringAfter("/user/").substringBefore("/daily/"))
                val count = views[title]
                if (count == null) {
                    respondJson("""{"items":[]}""")
                } else {
                    respondJson("""{"items":[{"views":$count}]}""")
                }
            }

            url.encodedPath == "/w/api.php" -> {
                // `titles` carries every source in the batch; `pltitles` filters the
                // links each page reports, exactly as the Action API does.
                val sources = url.parameters["titles"].orEmpty().split("|").map(Titles::canonical)
                val candidates = url.parameters["pltitles"].orEmpty().split("|").map(Titles::canonical).toSet()
                val pagesJson = sources.joinToString(",") { source ->
                    val out = links[source].orEmpty().filter { Titles.canonical(it) in candidates }
                    val linksJson = out.joinToString(",") { """{"ns":0,"title":"$it"}""" }
                    """{"title":"$source","links":[$linksJson]}"""
                }
                respondJson("""{"query":{"pages":[$pagesJson]}}""")
            }

            else -> respondJson("{}", HttpStatusCode.NotFound)
        }
    }

class CollectorTest : StringSpec({
    val date = LocalDate.of(2026, 6, 7)

    "assembles per-article views and classifies a mutual link as Excellent" {
        val client = wikimediaStub(
            views = mapOf("Lionel Messi" to 100_000L, "Cristiano Ronaldo" to 80_000L),
            links = mapOf(
                "Lionel Messi" to listOf("Cristiano Ronaldo"),
                "Cristiano Ronaldo" to listOf("Lionel Messi"),
            ),
        )
        val inputs = listOf(
            ScoringInput(
                leagueId = "l1",
                teamId = "t1",
                domain = "en",
                articles = listOf("Lionel_Messi", "Cristiano_Ronaldo"),
                chemistryLinks = listOf(listOf("Lionel_Messi", "Cristiano_Ronaldo")),
                formationSnapshot = """{"ST":"Lionel_Messi"}""",
            ),
        )

        val results = Collector.collect(inputs, WikimediaClient(client), concurrency = 3, date = date)

        results.size shouldBe 1
        results[0].teamId shouldBe "t1"
        results[0].articleViews shouldContainExactly listOf(100_000L, 80_000L)
        results[0].chemistryLevels shouldContainExactly listOf(ChemistryLevel.EXCELLENT)
        results[0].formationSnapshot shouldBe """{"ST":"Lionel_Messi"}"""
    }

    "classifies a one-way link as Good and no link as Weak" {
        val client = wikimediaStub(
            views = mapOf("A" to 10_000L, "B" to 10_000L, "C" to 10_000L),
            links = mapOf("A" to listOf("B")), // A→B only; nothing links to/from C.
        )
        val inputs = listOf(
            ScoringInput(
                leagueId = "l1",
                teamId = "t1",
                domain = "en",
                articles = listOf("A", "B", "C"),
                chemistryLinks = listOf(listOf("A", "B"), listOf("A", "C")),
                formationSnapshot = "{}",
            ),
        )

        val results = Collector.collect(inputs, WikimediaClient(client), concurrency = 3, date = date)

        results[0].chemistryLevels shouldContainExactly listOf(ChemistryLevel.GOOD, ChemistryLevel.WEAK)
    }

    "resolves every team's chemistry from a single link request" {
        var linkRequests = 0
        val client = mockJsonClient { request ->
            if (request.url.encodedPath == "/w/api.php") {
                linkRequests++
                val sources = request.url.parameters["titles"].orEmpty().split("|")
                val pages = sources.joinToString(",") { """{"title":"$it","links":[]}""" }
                respondJson("""{"query":{"pages":[$pages]}}""")
            } else {
                respondJson("""{"items":[{"views":1}]}""")
            }
        }
        // Three teams over an overlapping pool: the link graph is fetched once for
        // the whole domain, not once per team and not once per article.
        val inputs = (1..3).map { team ->
            ScoringInput(
                leagueId = "l1",
                teamId = "t$team",
                domain = "en",
                articles = listOf("A", "B", "C$team"),
                chemistryLinks = listOf(listOf("A", "B"), listOf("B", "C$team")),
                formationSnapshot = "{}",
            )
        }

        Collector.collect(inputs, WikimediaClient(client), concurrency = 3, date = date)

        linkRequests shouldBe 1
    }

    "scores a missing article as 0 views and warns" {
        val client = wikimediaStub(views = emptyMap(), links = emptyMap())
        val warnings = mutableListOf<String>()
        val inputs = listOf(
            ScoringInput(
                leagueId = "l1",
                teamId = "t1",
                domain = "en",
                articles = listOf("Ghost_Article"),
                chemistryLinks = emptyList(),
                formationSnapshot = "{}",
            ),
        )

        val results = Collector.collect(
            inputs,
            WikimediaClient(client),
            concurrency = 3,
            date = date,
            warn = { warnings.add(it) },
        )

        results[0].articleViews shouldContainExactly listOf(0L)
        warnings.size shouldBe 1
    }
})
