/**
 * Just enough markdown awareness to read links and headings without pulling a
 * parser in. Everything here works on raw source with code removed first —
 * `<number>` inside backticks is a placeholder, not a link, and a fenced block
 * full of `[foo](bar)` is a code sample, not an edge in the docs graph.
 */

const FENCE = /^\s*(?:```|~~~)/;
const LINK = /(\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g;
const CODE_SPAN = /`[^`]*`/g;
const HTML_HREF = /<a\b[^>]*\shref="([^"]+)"/g;

/**
 * The stand-in a code span is swapped for while links are rewritten. A control
 * character, built rather than written as an escape, because it must be one
 * byte no markdown file will ever legitimately contain.
 */
const MASK = String.fromCharCode(1);
const MASKED = new RegExp(`${MASK}(\\d+)${MASK}`, "g");

/** Drops fenced blocks and inline code spans, keeping line count intact. */
export function stripCode(source) {
  const lines = source.split(/\r?\n/);
  let inFence = false;
  const kept = lines.map((line) => {
    if (FENCE.test(line)) {
      inFence = !inFence;
      return "";
    }
    return inFence ? "" : line.replace(CODE_SPAN, "");
  });
  return kept.join("\n");
}

/**
 * Every markdown link in the body, tagged with whether it sits under the
 * closing `## Related` heading. That section is the curated edge list the docs
 * convention asks for; inline links are the incidental ones. The Atlas draws
 * them differently, so the distinction has to survive extraction.
 */
export function extractLinks(source) {
  const body = stripCode(source);
  const links = [];
  let inRelated = false;

  for (const line of body.split("\n")) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) inRelated = /^related$/i.test(heading[1]);

    for (const match of line.matchAll(LINK)) {
      links.push({ text: match[1], target: match[2], related: inRelated });
    }

    // The authored pages link through card markup as well as through prose. An
    // `<a href>` is the same edge as a `[text](target)`, and leaving it out
    // would make the landing page look like a document nothing connects to.
    for (const match of line.matchAll(HTML_HREF)) {
      links.push({ text: "", target: match[1], related: false });
    }
  }
  return links;
}

/** The first `# ` heading, used when a doc carries no frontmatter title. */
export function firstHeading(source) {
  const match = /^#\s+(.+?)\s*$/m.exec(stripCode(source));
  return match ? match[1].replace(/\s*\(.*\)\s*$/, "") : undefined;
}

/** A rough word count — the Atlas sizes nodes by it, so exactness is noise. */
export function wordCount(source) {
  return stripCode(source).split(/\s+/).filter(Boolean).length;
}

/**
 * The lead paragraph, flattened to plain text. Used as the hover blurb in the
 * Atlas and the one-liner under each neighbour link.
 */
export function summarise(source, limit = 180) {
  const body = stripCode(source)
    .replace(/^---[\s\S]*?^---/m, "")
    .split(/\n/);

  const paragraph = [];
  for (const line of body) {
    const text = line.trim();
    if (!text) {
      if (paragraph.length) break;
      continue;
    }
    if (/^[#>|:\-*]/.test(text)) {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(text);
  }

  const flat = paragraph
    .join(" ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (flat.length <= limit) return flat;
  return `${flat.slice(0, flat.lastIndexOf(" ", limit))}…`;
}

/**
 * Rewrites link targets outside code.
 *
 * Two things have to survive this pass. The `Linking` section of the docs index
 * shows a relative link as an *example* of the convention, and a blind regex
 * over the raw source would rewrite that illustration into a real URL — turning
 * a rule into a contradiction of itself. Meanwhile a link whose own label is
 * code still has to be rewritten, which is what rules out the obvious
 * implementation of splitting each line on its backticks.
 *
 * So the code spans are lifted out, the links are mapped, and the spans go back.
 */
export function mapLinks(source, mapper) {
  const lines = source.split(/\r?\n/);
  let inFence = false;

  const mapped = lines.map((line) => {
    if (FENCE.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    const spans = [];
    const masked = line.replace(CODE_SPAN, (span) => {
      spans.push(span);
      return `${MASK}${spans.length - 1}${MASK}`;
    });

    const rewritten = masked.replace(LINK, (whole, open, target, close) => {
      const replacement = mapper(target);
      return replacement === undefined ? whole : `${open}${replacement}${close}`;
    });

    return rewritten.replace(MASKED, (_, index) => spans[Number(index)]);
  });

  return mapped.join("\n");
}
