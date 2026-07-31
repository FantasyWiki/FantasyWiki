package io.github.fantasywiki.collector

import java.time.LocalDate
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit

/** Dedup key for a per-article view fetch — one popular article shared by many teams is fetched once. */
private data class ViewKey(val domain: String, val title: String)

/** Dedup key for a per-source link fetch. */
private data class LinkKey(val domain: String, val source: String)

/**
 * Turns the day's [ScoringInput]s into the raw [PerformanceResult]s the backend
 * scores: fetches each distinct article's daily views and resolves each Chemistry
 * Link's direction from the Wikipedia link graph, then assembles per-team results.
 * Fetches are deduped across teams and throttled to `concurrency` in flight.
 *
 * Backend-free by design (it takes inputs and returns results), so it is fully
 * testable against a [WikimediaClient] backed by a Ktor `MockEngine`.
 */
object Collector {
    /** Fetches the day's Wikimedia signals for [inputs] and returns per-team raw results. */
    suspend fun collect(
        inputs: List<ScoringInput>,
        wikimedia: WikimediaClient,
        concurrency: Int,
        date: LocalDate,
        warn: (String) -> Unit = {},
    ): List<PerformanceResult> {
        val semaphore = Semaphore(concurrency)
        val views = fetchViews(inputs, wikimedia, semaphore, date)
        val partners = buildPartners(inputs)
        val links = fetchLinks(partners, wikimedia, semaphore)

        return inputs.map { input ->
            PerformanceResult(
                teamId = input.teamId,
                articleViews = input.articles.map { article ->
                    val key = ViewKey(input.domain, Titles.canonical(article))
                    views[key] ?: run {
                        warn("no views for ${input.domain}:$article on $date — scoring as 0")
                        0L
                    }
                },
                chemistryLevels = input.chemistryLinks.mapNotNull { pair ->
                    classifyPair(input.domain, pair, links)
                },
                formationSnapshot = input.formationSnapshot,
            )
        }
    }

    private suspend fun fetchViews(
        inputs: List<ScoringInput>,
        wikimedia: WikimediaClient,
        semaphore: Semaphore,
        date: LocalDate,
    ): Map<ViewKey, Long?> {
        val keys = inputs.flatMap { input ->
            input.articles.map { ViewKey(input.domain, Titles.canonical(it)) }
        }.toSet()
        return coroutineScope {
            keys.associateWith { key ->
                async { semaphore.withPermit { wikimedia.dailyViews(key.domain, key.title, date) } }
            }.mapValues { (_, deferred) -> deferred.await() }
        }
    }

    /** Per domain: every canonical article that takes part in at least one Chemistry Link. */
    private fun buildPartners(inputs: List<ScoringInput>): Map<String, Set<String>> {
        val partners = mutableMapOf<String, MutableSet<String>>()
        for (input in inputs) {
            val byDomain = partners.getOrPut(input.domain) { mutableSetOf() }
            for (pair in input.chemistryLinks) {
                if (pair.size != 2) continue
                byDomain.add(Titles.canonical(pair[0]))
                byDomain.add(Titles.canonical(pair[1]))
            }
        }
        return partners
    }

    /**
     * The link graph among every linked article, one batched request per domain
     * (see [WikimediaClient.outboundLinksAmong]) rather than one per article — so
     * this phase costs ~1 request a night instead of scaling with the article pool.
     */
    private suspend fun fetchLinks(
        partners: Map<String, Set<String>>,
        wikimedia: WikimediaClient,
        semaphore: Semaphore,
    ): Map<LinkKey, Set<String>> = coroutineScope {
        partners.map { (domain, articles) ->
            async {
                semaphore.withPermit { wikimedia.outboundLinksAmong(domain, articles) }
                    .mapKeys { (source, _) -> LinkKey(domain, source) }
            }
        }.awaitAll().reduceOrNull { a, b -> a + b }.orEmpty()
    }

    private fun classifyPair(domain: String, pair: List<String>, links: Map<LinkKey, Set<String>>): ChemistryLevel? {
        if (pair.size != 2) return null
        val a = Titles.canonical(pair[0])
        val b = Titles.canonical(pair[1])
        val aToB = links[LinkKey(domain, a)]?.contains(b) ?: false
        val bToA = links[LinkKey(domain, b)]?.contains(a) ?: false
        return Chemistry.classify(aToB, bToA)
    }
}
