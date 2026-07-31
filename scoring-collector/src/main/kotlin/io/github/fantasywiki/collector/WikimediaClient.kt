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
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** AQS per-article response: one item per day in the queried range. */
@Serializable
private data class AqsResponse(val items: List<AqsItem> = emptyList())

@Serializable
private data class AqsItem(val views: Long)

/** Action API `prop=links` response (formatversion=2). */
@Serializable
private data class LinksResponse(
    val query: LinksQuery? = null,
    @SerialName("continue") val continuation: LinksContinue? = null,
)

/** Present when the response hit `pllimit` and more link rows remain. */
@Serializable
private data class LinksContinue(val plcontinue: String? = null)

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
 * Reads the two public Wikimedia signals the collector needs: daily views, one
 * request per article (AQS has no batch form), and the link graph, batched up to
 * the Action API's 50-title cap. Throttling/concurrency is the caller's concern —
 * see [Main]. Every comparison of titles goes through [Titles.canonical] so a link
 * is never missed on an underscore/case spelling difference.
 */
class WikimediaClient(private val http: HttpClient) {
    private companion object {
        const val AQS_HOST = "https://wikimedia.org"

        /**
         * Action API cap on `titles` and `pltitles` alike — 50 values for a client
         * without higher limits; exceeding it is a hard `toomanyvalues` error, not a
         * truncation. @see https://www.mediawiki.org/wiki/API:Links
         */
        const val MAX_TITLES_PER_REQUEST = 50

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
     * The directed link graph *among* [articles]: canonical source → the subset of
     * [articles] it links to. Everything a Chemistry Link needs (both directions of
     * every pair) comes out of this one map.
     *
     * `prop=links` takes up to [MAX_TITLES_PER_REQUEST] values in **both** `titles`
     * and `pltitles`, so a whole lineup — or a whole night's article pool — is one
     * request rather than one per article. Larger pools walk the block grid of
     * (source chunk × candidate chunk), which stays cheaper than a request per
     * article until the pool passes 50² articles.
     *
     * Absent sources mean "links to nothing here": pages that are missing, or that
     * link to none of [articles], simply have no entry.
     */
    suspend fun outboundLinksAmong(domain: String, articles: Collection<String>): Map<String, Set<String>> {
        // Sorted so chunk boundaries — and therefore the requests — are deterministic.
        val canonical = articles.map(Titles::canonical).filter { it.isNotEmpty() }.distinct().sorted()
        // A single article has no partner in the set, so there is nothing to ask about.
        if (canonical.size < 2) return emptyMap()

        val blocks = canonical.chunked(MAX_TITLES_PER_REQUEST)
        val graph = mutableMapOf<String, MutableSet<String>>()
        for (sources in blocks) {
            for (candidates in blocks) {
                for ((source, targets) in linksBetween(domain, sources, candidates)) {
                    graph.getOrPut(source) { mutableSetOf() }.addAll(targets)
                }
            }
        }
        return graph
    }

    /**
     * Which of [candidates] does each of [sources] link to, following continuation.
     *
     * `pllimit=max` is 500 link rows **per response across all pages**, well under
     * the 50×50 a full block can produce, so a truncated page hands back a
     * `plcontinue` token instead of the rest. Dropping it would read as "no link"
     * and silently downgrade a Chemistry Link to Weak, so the loop drains it.
     */
    private suspend fun linksBetween(
        domain: String,
        sources: List<String>,
        candidates: List<String>,
    ): Map<String, Set<String>> {
        val graph = mutableMapOf<String, MutableSet<String>>()
        var plcontinue: String? = null

        do {
            val url = URLBuilder("https://$domain.wikipedia.org").apply {
                appendPathSegments("w", "api.php")
                parameters.append("action", "query")
                parameters.append("prop", "links")
                parameters.append("titles", sources.joinToString("|"))
                parameters.append("pltitles", candidates.joinToString("|"))
                parameters.append("pllimit", "max")
                parameters.append("format", "json")
                parameters.append("formatversion", "2")
                plcontinue?.let { parameters.append("plcontinue", it) }
            }.buildString()

            val response: HttpResponse = http.get(url)
            val body = response.body<LinksResponse>()
            // Response titles are the API's normalized form — first character
            // upper-cased, exactly what Titles.canonical does — so these keys match
            // the caller's canonical article names. See classifyPair.
            for (page in body.query?.pages.orEmpty()) {
                if (page.missing || page.links.isEmpty()) continue
                graph.getOrPut(Titles.canonical(page.title)) { mutableSetOf() }
                    .addAll(page.links.map { Titles.canonical(it.title) })
            }
            plcontinue = body.continuation?.plcontinue
        } while (plcontinue != null)

        return graph
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
