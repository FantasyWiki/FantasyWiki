package io.github.fantasywiki.collector

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.statement.HttpResponse
import io.ktor.http.HttpStatusCode
import io.ktor.http.URLBuilder
import io.ktor.http.appendPathSegments
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import kotlinx.serialization.Serializable

/** AQS per-article response: one item per day in the queried range. */
@Serializable
private data class AqsResponse(val items: List<AqsItem> = emptyList())

@Serializable
private data class AqsItem(val views: Long)

/** Action API `prop=links` response (formatversion=2). */
@Serializable
private data class LinksResponse(val query: LinksQuery? = null)

@Serializable
private data class LinksQuery(val pages: List<LinksPage> = emptyList())

@Serializable
private data class LinksPage(
    val title: String = "",
    val missing: Boolean = false,
    val links: List<LinkTarget> = emptyList(),
)

@Serializable
private data class LinkTarget(val title: String)

/**
 * Reads the two public Wikimedia signals the collector needs, one request per
 * method (throttling/concurrency is the caller's concern — see [Main]). Every
 * comparison of titles goes through [Titles.canonical] so a link is never missed
 * on an underscore/case spelling difference.
 */
class WikimediaClient(private val http: HttpClient) {
    private companion object {
        const val AQS_HOST = "https://wikimedia.org"
        val DATE_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyyMMdd")
    }

    /**
     * A single article's raw pageviews for [date] (AQS per-article, one-day range).
     * Returns null when the article has no data for that day (404 / empty items) —
     * the caller treats that as 0 base points with a warning, never a hard failure.
     */
    suspend fun dailyViews(domain: String, title: String, date: LocalDate): Long? {
        val stamp = date.format(DATE_FORMAT)
        val url = URLBuilder(AQS_HOST).apply {
            appendPathSegments(
                "api", "rest_v1", "metrics", "pageviews", "per-article",
                "$domain.wikipedia", "all-access", "user",
                // Spaces→underscores as Wikipedia expects; Ktor percent-encodes the rest.
                title.replace(' ', '_'),
                "daily", stamp, stamp,
            )
        }.buildString()

        val response = http.get(url)
        if (response.status == HttpStatusCode.NotFound) return null
        val body: AqsResponse = response.body()
        return body.items.firstOrNull()?.views
    }

    /**
     * Which of [candidates] the [source] article links to, as canonical titles.
     * Uses the Action API `pltitles` filter so the response is bounded to the
     * handful of relevant targets — never a hub's full (paginated) link list.
     */
    suspend fun outboundLinks(domain: String, source: String, candidates: Collection<String>): Set<String> {
        if (candidates.isEmpty()) return emptySet()
        val url = URLBuilder("https://$domain.wikipedia.org").apply {
            appendPathSegments("w", "api.php")
            parameters.append("action", "query")
            parameters.append("prop", "links")
            parameters.append("titles", source)
            parameters.append("pltitles", candidates.joinToString("|"))
            parameters.append("pllimit", "max")
            parameters.append("format", "json")
            parameters.append("formatversion", "2")
        }.buildString()

        val response: HttpResponse = http.get(url)
        val page = response.body<LinksResponse>().query?.pages?.firstOrNull()
        return if (page == null || page.missing) {
            emptySet()
        } else {
            page.links.map { Titles.canonical(it.title) }.toSet()
        }
    }
}

/** Pure classification of one Chemistry Link from the two directed link facts (scoring-system.md §4). */
object Chemistry {
    /** Classifies a pair from whether each endpoint links to the other. */
    fun classify(sourceLinksToTarget: Boolean, targetLinksToSource: Boolean): ChemistryLevel = when {
        sourceLinksToTarget && targetLinksToSource -> ChemistryLevel.EXCELLENT
        sourceLinksToTarget || targetLinksToSource -> ChemistryLevel.GOOD
        else -> ChemistryLevel.WEAK
    }
}
