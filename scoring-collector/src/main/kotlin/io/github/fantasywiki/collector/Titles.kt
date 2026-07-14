package io.github.fantasywiki.collector

/**
 * Canonical Wikipedia article-title normalization — the single defence against
 * synergy silently reading as "no link" because three title sources disagree (the
 * stored articleId, AQS pageview titles, and Action-API link titles). Wikipedia
 * treats `_` and space as equivalent and is case-insensitive on the *first*
 * character only. Applying one canonical form on both sides of every comparison
 * keeps a link from being missed on a spelling that is really the same page.
 */
object Titles {
    private val whitespace = Regex("\\s+")

    /** Underscores→spaces, collapse/trim whitespace, upper-case the first character. */
    fun canonical(raw: String): String {
        val spaced = raw.replace('_', ' ')
        val collapsed = whitespace.replace(spaced, " ").trim()
        if (collapsed.isEmpty()) return collapsed
        return collapsed.replaceFirstChar { it.uppercaseChar() }
    }
}
