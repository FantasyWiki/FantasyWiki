import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./paths.mjs";

/**
 * The canonical vocabulary, read from the file that defines it.
 *
 * `CONTEXT.md` is the glossary — the site renders it, it does not restate it.
 * A term added there appears on the page at the next build, with its avoid list
 * and its cross-references, and nobody has to remember a second place.
 *
 * The definitions are prose, inline code and bold, and nothing else, so they
 * are converted here by hand rather than by pulling in a markdown renderer for
 * three constructs. That is a claim about the source: if a definition ever
 * grows a list or a link, this stops being enough and `markdown-it` should be
 * declared the way `api.mjs` declares `yaml`.
 */

const SOURCE = path.join(REPO_ROOT, "CONTEXT.md");

/**
 * A term opens a block: bold text alone on a line, closed by a colon. The
 * anchoring at both ends is load-bearing — `Purchase Price / Current Price`
 * has a definition that itself *begins* `**Purchase Price** is the …`, and a
 * looser pattern would read that body line as a new term.
 */
const TERM = /^\*\*(.+?)\*\*:\s*$/;
const AVOID = /^_Avoid_:\s*(.+?)\.?\s*$/;
const ALLOWED = /^Allowed values:\s*(.+?)\.?\s*$/;

/**
 * The marker that says a term is one the rest of the documentation cannot be
 * read without. It is what the exam report's glossary is cut down to, so that a
 * document read straight through carries the vocabulary it is written in rather
 * than the whole ingestion pipeline. A flag on the term, not a second list of
 * names, because a list somewhere else is a list that goes stale on the next
 * term anyone adds.
 */
const CORE = /^_Core_\.?\s*$/;

/** The vocabulary lives under one heading; everything after it is commentary. */
function languageSection(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Language\s*$/.test(line));
  if (start === -1) return { lines: [], rest: lines };

  const after = lines.slice(start + 1);
  const end = after.findIndex((line) => /^##\s+/.test(line));
  return end === -1
    ? { lines: after, rest: [] }
    : { lines: after.slice(0, end), rest: after.slice(end) };
}

function splitList(text) {
  return text
    .split(",")
    .map((item) => item.replace(/\*\*/g, "").trim())
    .filter(Boolean);
}

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The key a cross-reference is looked up by. Case and the bold markers go, and
 * so does a trailing plural — the definitions say "a set of **Positions**" and
 * mean the term **Position**.
 */
function key(text) {
  return text
    .replace(/\*\*/g, "")
    .trim()
    .toLowerCase()
    .replace(/s$/, "");
}

function parseTerms(lines) {
  const terms = [];
  let current = null;

  for (const line of lines) {
    const heading = TERM.exec(line);
    if (heading) {
      current = {
        term: heading[1].trim(),
        id: slug(heading[1]),
        definition: [],
        avoid: [],
        allowed: [],
        core: false,
      };
      terms.push(current);
      continue;
    }
    if (!current) continue;

    const avoid = AVOID.exec(line);
    if (avoid) {
      current.avoid = splitList(avoid[1]);
      continue;
    }

    const allowed = ALLOWED.exec(line);
    if (allowed) {
      current.allowed = splitList(allowed[1]);
      continue;
    }

    if (CORE.test(line)) {
      current.core = true;
      continue;
    }

    if (line.trim()) current.definition.push(line.trim());
  }

  return terms;
}

/**
 * Every name that resolves to a term: the term itself, each half of a paired
 * one like `Purchase Price / Current Price`, and the allowed values a term
 * enumerates, so that **Free Agent** in one definition lands on the term that
 * defines it. First writer wins, so a term never loses its own name to a value,
 * and two terms that normalise to the same key — a singular and its plural,
 * were both ever defined — resolve to whichever is written first.
 */
function buildIndex(terms) {
  const index = new Map();

  const add = (name, id) => {
    const k = key(name);
    if (k && !index.has(k)) index.set(k, id);
  };

  for (const term of terms) {
    add(term.term, term.id);
    for (const half of term.term.split("/")) add(half, term.id);
  }
  for (const term of terms) {
    for (const value of term.allowed) add(value, term.id);
  }

  return index;
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Prose to HTML, in the one order that survives the source.
 *
 * Code spans come out first and travel as placeholders: a definition contains
 * a factor `> 1`, and escaping before extracting would turn the backticked
 * comparison into an entity that no longer reads as code. Bold is resolved
 * against the term index, which is what makes the canonical vocabulary
 * navigable rather than merely emphasised.
 */
function inline(text, index) {
  const code = [];
  const withPlaceholders = text.replace(/`([^`]+)`/g, (_, body) => {
    code.push(body);
    return `\u0000${code.length - 1}\u0000`;
  });

  return escapeHtml(withPlaceholders)
    .replace(/\*\*([^*]+)\*\*/g, (match, body) => {
      const id = index.get(key(body));
      return id ? `<a class="gloss__ref" href="#${id}">${body}</a>` : `<strong>${body}</strong>`;
    })
    .replace(/(^|[\s(])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\u0000(\d+)\u0000/g, (_, position) => `<code>${escapeHtml(code[position])}</code>`);
}

export function collectGlossary() {
  if (!fs.existsSync(SOURCE)) return { present: false };

  const markdown = fs.readFileSync(SOURCE, "utf8");
  const { lines, rest } = languageSection(markdown);
  const parsed = parseTerms(lines);
  const index = buildIndex(parsed);

  /*
   * A second rendering of every core definition, resolved against the core
   * terms alone. The report shows that subset on a page of its own, and a
   * cross-reference to a term the page does not carry would be an anchor
   * pointing at nothing — so in this pass those references stay bold and stop
   * claiming to be links.
   */
  const coreIndex = buildIndex(parsed.filter((term) => term.core));

  const terms = parsed.map((term) => ({
    id: term.id,
    term: term.term,
    definition: inline(term.definition.join(" "), index),
    definitionCore: term.core ? inline(term.definition.join(" "), coreIndex) : "",
    plain: [term.term, term.definition.join(" "), ...term.avoid].join(" ").toLowerCase(),
    allowed: term.allowed,
    avoid: term.avoid,
    core: term.core,
  }));

  return {
    present: true,
    source: "CONTEXT.md",
    terms,
    // A term defined outside the Language section would be dropped in silence,
    // which is the one way this page can be wrong without anything failing.
    stray: rest.filter((line) => TERM.test(line)).length,
    undefinedTerms: terms.filter((term) => !term.definition).map((term) => term.term),
    withAvoid: terms.filter((term) => term.avoid.length > 0).length,
    core: terms.filter((term) => term.core).length,
  };
}
