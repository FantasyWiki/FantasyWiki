import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { MIRROR_DIR, PAGES_DIR, toPosix } from "./paths.mjs";
import { mapLinks } from "./markdown.mjs";

/**
 * One document containing every page the report covers.
 *
 * The site is a set of linked pages because that is how documentation is read.
 * A report is read straight through, once, by someone who did not choose to be
 * here — so it gets a single page, assembled from the same files, in the order
 * the report template asks for.
 *
 * Assembled rather than written: a hand-kept copy of fourteen pages is fourteen
 * chances to disagree with the original, and it would disagree within a week.
 * Everything here is read out of the mirror after it is built, which means the
 * canonical pages arrive with their outbound links already rewritten.
 */

/** The template's own running order, and what answers each section. */
const SECTIONS = [
  {
    title: "Introduction",
    lead: "What the game is, the loop a player is in, and the vocabulary the rest of this document is written in.",
    pages: ["overview/what-is-fantasywiki.md", "overview/glossary.md"],
  },
  {
    title: "Requirements",
    lead: "The domain model as a wall of notes, the functional obligations traced to what specifies and satisfies each, the quality attributes with the mechanism that enforces them, and the constraints.",
    pages: ["overview/requirements.md"],
  },
  {
    title: "Design",
    lead: "The architecture — context, containers, packages and layers — then how data moves through it, what is stored, and the screens it is played through.",
    pages: [
      "architecture/index.md",
      "architecture/data-flow.md",
      "architecture/data-model.md",
      "architecture/interface.md",
    ],
  },
  {
    title: "Technologies",
    lead: "Every technology the project runs on, the alternative it was chosen over, and the constraint that decided it.",
    pages: ["overview/technologies.md"],
  },
  {
    title: "Code",
    lead: "The two halves of the codebase whose structure is a decision rather than a convention.",
    pages: ["docs/architecture/backend-architecture.md", "architecture/frontend.md"],
  },
  {
    title: "Testing",
    lead: "What the automated suites cover and what they deliberately do not, and the tier no suite can stand in for.",
    pages: ["quality/testing.md", "quality/playtest.md"],
  },
  {
    title: "Deployment",
    lead: "Which branch reaches which environment, what runs where, and what has to be green first.",
    pages: ["architecture/deployment.md", "quality/ci-cd.md"],
  },
  {
    title: "Conclusions",
    lead: "What was built, which decisions held, and what would be done differently.",
    pages: ["quality/conclusions.md"],
  },
];

/** Where the assembled body is spliced into the authored page. */
const MARKER = "<!-- report-body -->";

export const REPORT_SOURCE = "report.md";

const FENCE = /^\s*(?:```|~~~)/;

/** A stable in-document anchor for a page, so links between them stay links. */
function anchorFor(mirrorPath) {
  return `p-${mirrorPath.replace(/\.md$/, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

/**
 * Pushes every heading down two levels, leaving fenced code alone — a shell
 * sample's `# comment` is not a heading, and demoting it would corrupt the one
 * kind of content on these pages that has to be copied verbatim.
 */
function demote(markdown) {
  let inFence = false;
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      if (FENCE.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return line.replace(/^(#{1,4})(\s)/, "$1##$2");
    })
    .join("\n");
}

/** The page's own title heading and its closing `## Related` list both go. */
function trim(markdown) {
  const withoutTitle = markdown.replace(/^#\s+.*$/m, "").trimStart();
  const related = withoutTitle.search(/^##\s+Related\s*$/m);
  return (related === -1 ? withoutTitle : withoutTitle.slice(0, related)).trimEnd();
}

/**
 * Link targets, re-pointed for a document that lives at the site root.
 *
 * A link to a page that is *in* the report becomes an anchor — the reader stays
 * put, which is the whole point of assembling this. Everything else keeps
 * working by being re-resolved from the source page's directory to the root the
 * report is served from.
 */
function repoint(markdown, sourceDir, included) {
  return mapLinks(markdown, (target) => {
    if (/^(?:[a-z]+:|#|\/)/i.test(target)) return undefined;

    const [pathPart, hash = ""] = target.split("#");
    if (!pathPart) return undefined;

    let resolved = path.posix.normalize(path.posix.join(sourceDir, pathPart));
    if (resolved.endsWith("/")) resolved += "index.md";
    resolved = resolved.replace(/\.html$/, ".md");

    if (included.has(resolved)) return hash ? `#${hash}` : `#${anchorFor(resolved)}`;
    return `./${resolved}${hash ? `#${hash}` : ""}`;
  });
}

export function buildReport() {
  const authored = path.join(PAGES_DIR, REPORT_SOURCE);
  if (!fs.existsSync(authored)) return { present: false };

  const included = new Set(SECTIONS.flatMap((section) => section.pages));
  const parts = [];
  const missing = [];
  let pages = 0;

  for (const [index, section] of SECTIONS.entries()) {
    parts.push(`## ${index + 1} · ${section.title}\n\n${section.lead}\n`);

    for (const page of section.pages) {
      const file = path.join(MIRROR_DIR, page);
      if (!fs.existsSync(file)) {
        missing.push(page);
        continue;
      }

      const parsed = matter(fs.readFileSync(file, "utf8"));
      const title = parsed.data.title ?? page;
      const body = repoint(demote(trim(parsed.content)), path.posix.dirname(page), included);

      parts.push(`### ${title} {#${anchorFor(page)}}\n\n${body}\n`);
      pages += 1;
    }
  }

  const header = matter(fs.readFileSync(authored, "utf8"));
  if (!header.content.includes(MARKER)) {
    throw new Error(`${REPORT_SOURCE} has no ${MARKER} to assemble into`);
  }

  const content = header.content.replace(MARKER, parts.join("\n"));
  const data = { ...header.data, source: toPosix(path.join("docs/site/pages", REPORT_SOURCE)), tier: "site" };

  fs.writeFileSync(path.join(MIRROR_DIR, REPORT_SOURCE), matter.stringify(content, data));

  return { present: true, sections: SECTIONS.length, pages, missing };
}
