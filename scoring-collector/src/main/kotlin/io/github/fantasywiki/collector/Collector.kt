package io.github.fantasywiki.collector

import java.time.LocalDate
import kotlinx.coroutines.async
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

    /** Per domain: canonical article → the set of canonical articles it shares a Chemistry Link with. */
    private fun buildPartners(inputs: List<ScoringInput>): Map<String, Map<String, Set<String>>> {
        val partners = mutableMapOf<String, MutableMap<String, MutableSet<String>>>()
        for (input in inputs) {
            val byDomain = partners.getOrPut(input.domain) { mutableMapOf() }
            for (pair in input.chemistryLinks) {
                if (pair.size != 2) continue
                val a = Titles.canonical(pair[0])
                val b = Titles.canonical(pair[1])
                byDomain.getOrPut(a) { mutableSetOf() }.add(b)
                byDomain.getOrPut(b) { mutableSetOf() }.add(a)
            }
        }
        return partners
    }

    /** For each (domain, source), which of its partners it links to — one bounded request each. */
    private suspend fun fetchLinks(
        partners: Map<String, Map<String, Set<String>>>,
        wikimedia: WikimediaClient,
        semaphore: Semaphore,
    ): Map<LinkKey, Set<String>> {
        val tasks = partners.flatMap { (domain, sources) ->
            sources.map { (source, candidates) -> LinkKey(domain, source) to candidates }
        }
        return coroutineScope {
            tasks.associate { (key, candidates) ->
                key to async {
                    semaphore.withPermit { wikimedia.outboundLinks(key.domain, key.source, candidates) }
                }
            }.mapValues { (_, deferred) -> deferred.await() }
        }
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
