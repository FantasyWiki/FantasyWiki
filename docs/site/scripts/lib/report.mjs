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
 * the exam's assessment criteria ask for.
 *
 * Assembled rather than written: a hand-kept copy of these pages is one chance
 * per page to disagree with the original, and it would disagree within a week.
 * Everything here is read out of the mirror after it is built, which means the
 * canonical pages arrive with their outbound links already rewritten.
 */

/**
 * The running order, and what answers each section.
 *
 * The order is the exam's own assessment criteria rather than a generic report
 * template: domain-driven design, a clear development process, full-scale
 * automation including CI and delivery, deploy automation via containerization
 * or orchestration, and two or more target platforms. An examiner reading this
 * straight through should meet each criterion under its own heading, in that
 * order, instead of having to assemble it from pages about screens and data
 * shapes.
 *
 * That is also why the interface, frontend, data-model and playtest pages are
 * not here. They are good pages and the site still serves them; they answer a
 * question this document is not being read to answer.
 *
 * The development process, the branching model, Conventional Commits, the
 * `master` ruleset, review and release, follows domain-driven design because
 * that is where the criteria put it. The use of generative AI closes the body,
 * before the conclusions, because it is a statement about how everything above
 * was produced rather than about any one part of it.
 */
const SECTIONS = [
  {
    title: "Introduction",
    lead: "What the game is, the loop a player is in, and the vocabulary the rest of this document is written in.",
    pages: ["overview/what-is-fantasywiki.md", "overview/glossary.md"],
  },
  {
    title: "Domain-driven design",
    lead: "How the model was discovered before it was written down, which DDD archetype each concept became and the perimeter the model deliberately sets, and one aggregate invariant followed all the way to the line that enforces it.",
    pages: [
      "overview/requirements.md",
      "docs/architecture/ddd-building-blocks.md",
      "docs/adr/0007-derived-team-credits.md",
    ],
  },
  {
    title: "Development process",
    lead: "How a change reaches production: the branches sized for two authors, the commit convention the release is computed from, the one gate every merge passes, how a version is cut and what it names, and the licence the work is published under.",
    pages: [
      "docs/development/development-process.md",
      "docs/development/release-process.md",
      "docs/adr/0009-agpl-license.md",
    ],
  },
  {
    title: "Architecture and target platforms",
    lead: "The system in context, containers and layers; the boundary that let a second persistence target arrive without a change above it; and the two runtimes the project technically involves, with the decision record that explains why the second one exists.",
    pages: [
      "architecture/index.md",
      "docs/architecture/backend-architecture.md",
      "docs/architecture/persistence-targets.md",
      "overview/technologies.md",
      "docs/adr/0004-scoring-engine-platform.md",
    ],
  },
  {
    title: "Automation and continuous integration",
    lead: "The workflow graph and what a green build is allowed to mean, then the suites that decide it and the tiers they are split into.",
    pages: ["quality/ci-cd.md", "quality/testing.md"],
  },
  {
    title: "Deployment, containerization and orchestration",
    lead: "Which branch reaches which environment and in what order, the target that is shipped as a container image rather than deployed, and the whole stack orchestrated locally from one file.",
    pages: ["architecture/deployment.md", "docs/development/docker-local-dev.md"],
  },
  {
    title: "Use of generative AI",
    lead: "Which AI tools were used to build the project, at what level of involvement in each process, how agents were kept inside the project's rules, and which skills they used and why.",
    pages: ["docs/development/ai-assistance.md"],
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

/**
 * The vocabulary, cut to the terms the report is written in.
 *
 * The site's page carries all of it, which is right for a page someone opens
 * to look a word up. The report is read straight through by someone who did
 * not choose to be here, and fifty entries between the introduction and the
 * requirements is a wall they will skip — so it carries the terms marked
 * `_Core_.` in `CONTEXT.md` and points at the page for the rest.
 */
function coreVocabulary(markdown) {
  return markdown.replace(/<Glossary\s*\/>/g, "<Glossary core />");
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
      const body = coreVocabulary(
        repoint(demote(trim(parsed.content)), path.posix.dirname(page), included),
      );

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
