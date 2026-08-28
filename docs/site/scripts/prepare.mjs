import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import matter from "gray-matter";

import {
  DOCS_DIR,
  GENERATED_DIR,
  GITHUB_BLOB,
  MIRROR_DIR,
  PAGES_DIR,
  REPO_ROOT,
  SITE_ROOT,
  toPosix,
  urlFor,
} from "./lib/paths.mjs";
import { extractLinks, firstHeading, mapLinks, summarise, wordCount } from "./lib/markdown.mjs";
import { collectCoverage } from "./lib/coverage.mjs";
import { collectApi } from "./lib/api.mjs";
import { collectGlossary } from "./lib/glossary.mjs";
import { buildReport, REPORT_SOURCE } from "./lib/report.mjs";

/**
 * Builds the tree VitePress reads.
 *
 * The site has two tiers and this script is the seam between them. The
 * canonical docs under `docs/` are mirrored unchanged — they are the source of
 * truth and are edited there, on GitHub, in the repository. The authored pages
 * under `docs/site/pages/` are the orientation layer that exists only on the
 * site. Both land in `docs/site/build/content/`, which is generated and
 * gitignored.
 *
 * Nothing here rewrites prose. The only edits are to link targets that point
 * out of the documentation and into the source tree, which have to become
 * GitHub URLs to survive the move.
 */

/** Repo-root documents that are entry points rather than reference material. */
const CHARTER = [
  { file: "CONTEXT.md", title: "Domain Glossary (source)", type: "charter" },
  { file: "PRODUCT.md", title: "Product Vision", type: "charter" },
  { file: "DESIGN.md", title: "Design System", type: "charter" },
  { file: "AGENTS.md", title: "Agent Skills", type: "charter" },
  { file: "CLAUDE.md", title: "Agent Instructions", type: "charter" },
];

/** Top-level repository directories that are code, not documentation. */
const SOURCE_DIRS = new Set([
  "backend",
  "frontend",
  "model",
  "dto",
  "scoring-collector",
  "docker",
  "gradle",
  "external-apis",
  ".github",
]);

/**
 * Documentation that stays in the repository and off the site.
 *
 * `docs/agents/` is machine-read metadata: skills load those files from fixed
 * paths, and a reader browsing the site gains nothing from a page describing a
 * triage label taxonomy. They are still canonical and still edited there —
 * links to them are rewritten to GitHub, exactly like a link to a source file.
 *
 * Repo-relative POSIX paths, because both users of this list — the walk and the
 * link rewrite — already work in that shape. Adding an entry here means also
 * removing its section from `SECTIONS` below, or the sidebar keeps a heading
 * with nothing under it.
 */
const UNPUBLISHED = ["docs/agents"];

function isUnpublished(repoPath) {
  return UNPUBLISHED.some((dir) => repoPath === dir || repoPath.startsWith(`${dir}/`));
}

/** What each canonical section is called in the sidebar. */
const SECTIONS = {
  domain: { title: "Domain" },
  architecture: { title: "Architecture" },
  development: { title: "Development" },
  deployment: { title: "Deployment" },
  adr: { title: "Decisions" },
};

function reset(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Files under `dir`, with whole directories pruned by `skip`.
 *
 * Pruning rather than filtering afterwards is load-bearing: the site lives at
 * `docs/site`, inside the tree it mirrors, so walking `docs/` unguarded would
 * descend into its own `node_modules` and mirror thousands of dependency
 * READMEs. Do not "simplify" this back into a flat walk.
 */
function walk(dir, skip = () => false) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (skip(full)) return [];
    return entry.isDirectory() ? walk(full, skip) : [full];
  });
}

/** The tooling half of `docs/`, which is never mirrored into itself. */
function isSiteItself(absolute) {
  return absolute === SITE_ROOT || absolute.startsWith(SITE_ROOT + path.sep);
}

function write(destination, contents) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, contents);
}

/**
 * YAML has no way to write `undefined`, and gray-matter throws rather than
 * skipping it. A doc that has never been committed has no last-changed date,
 * which is the normal state of the file somebody is writing right now.
 */
function defined(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

/**
 * One `git log` pass over the whole documentation history, rather than a
 * process per file. Commits arrive newest first, so the first time a path is
 * named is the last time it changed.
 */
function lastModifiedByPath() {
  const RECORD_SEPARATOR = "\u001e";

  const dates = new Map();
  try {
    const log = execFileSync(
      "git",
      [
        "log",
        "--pretty=format:%x1e%cI",
        "--name-only",
        "--",
        "docs",
        ...CHARTER.map((entry) => entry.file),
      ],
      { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );

    let current;
    for (const line of log.split(/\r?\n/)) {
      if (line.startsWith(RECORD_SEPARATOR)) {
        current = line.slice(1);
        continue;
      }
      const file = line.trim();
      if (file && current && !dates.has(file)) dates.set(file, current);
    }
  } catch {
    // A shallow clone or a missing git binary costs the timestamps, nothing else.
  }
  return dates;
}

/**
 * Link targets that leave the documentation tree cannot follow it onto the
 * site — `../../backend/migrations/0008_league_closure.sql` is a file in the
 * repository, not a page. They become GitHub URLs, resolved against the
 * document's real location rather than its mirrored one.
 */
function rewriteOutboundLinks(source, sourceRepoPath) {
  const sourceDir = path.posix.dirname(sourceRepoPath);

  return mapLinks(source, (target) => {
    if (/^(?:[a-z]+:|#|\/)/i.test(target)) return undefined;

    const [pathPart, hash = ""] = target.split("#");
    if (!pathPart) return undefined;

    const resolved = path.posix.normalize(path.posix.join(sourceDir, pathPart));
    const top = resolved.split("/")[0];

    if (SOURCE_DIRS.has(top) || isUnpublished(resolved)) {
      return `${GITHUB_BLOB}/${resolved}${hash ? `#${hash}` : ""}`;
    }

    // The docs index is `README.md` in the repository, because that is what
    // GitHub renders for a directory, and `index.md` on the site, because that
    // is what a static host serves. Links to it have to follow the rename.
    if (/(^|\/)README\.md$/.test(pathPart)) {
      return `${pathPart.replace(/(^|\/)README\.md$/, "$1index.md")}${hash ? `#${hash}` : ""}`;
    }

    return undefined;
  });
}

function mirrorDocs(modified) {
  const entries = [];

  const skip = (absolute) =>
    isSiteItself(absolute) || isUnpublished(toPosix(path.relative(REPO_ROOT, absolute)));

  for (const absolute of walk(DOCS_DIR, skip)) {
    const repoPath = toPosix(path.relative(REPO_ROOT, absolute));
    const withinDocs = toPosix(path.relative(DOCS_DIR, absolute));

    if (!absolute.endsWith(".md")) {
      // Assets travel with the docs so relative image paths keep working.
      fs.mkdirSync(path.dirname(path.join(MIRROR_DIR, "docs", withinDocs)), { recursive: true });
      fs.copyFileSync(absolute, path.join(MIRROR_DIR, "docs", withinDocs));
      continue;
    }

    // `README.md` is the docs index on GitHub; on the site it is the section root.
    const mirrorPath = path.posix.join("docs", withinDocs.replace(/(^|\/)README\.md$/, "$1index.md"));
    const raw = fs.readFileSync(absolute, "utf8");
    const parsed = matter(raw);
    const section = withinDocs.includes("/") ? withinDocs.split("/")[0] : "index";

    const data = {
      ...parsed.data,
      title: parsed.data.title ?? firstHeading(parsed.content) ?? withinDocs,
      source: repoPath,
      section,
      updated: modified.get(repoPath),
    };

    write(
      path.join(MIRROR_DIR, mirrorPath),
      matter.stringify(rewriteOutboundLinks(parsed.content, repoPath), defined(data)),
    );

    entries.push({
      id: mirrorPath,
      url: urlFor(mirrorPath),
      source: repoPath,
      title: data.title,
      type: parsed.data.type ?? section,
      tags: parsed.data.tags ?? [],
      section,
      tier: "canonical",
      summary: summarise(parsed.content),
      words: wordCount(parsed.content),
      updated: data.updated,
      links: extractLinks(parsed.content),
      dir: path.posix.dirname(mirrorPath),
    });
  }

  return entries;
}

function mirrorCharter(modified) {
  return CHARTER.flatMap(({ file, title, type }) => {
    const absolute = path.join(REPO_ROOT, file);
    if (!fs.existsSync(absolute)) return [];

    const raw = fs.readFileSync(absolute, "utf8");
    const parsed = matter(raw);
    const mirrorPath = file;

    const data = {
      ...parsed.data,
      title: parsed.data.title ?? title,
      source: file,
      section: "charter",
      updated: modified.get(file),
    };

    write(
      path.join(MIRROR_DIR, mirrorPath),
      matter.stringify(rewriteOutboundLinks(parsed.content, file), defined(data)),
    );

    return [
      {
        id: mirrorPath,
        url: urlFor(mirrorPath),
        source: file,
        title: data.title,
        type,
        tags: parsed.data.tags ?? [],
        section: "charter",
        tier: "canonical",
        summary: summarise(parsed.content),
        words: wordCount(parsed.content),
        updated: data.updated,
        links: extractLinks(parsed.content),
        dir: ".",
      },
    ];
  });
}

/**
 * Static assets served from the site root — the favicon, the logo in the nav.
 *
 * VitePress looks for `public/` inside `srcDir`, and `srcDir` here is the
 * generated mirror. So the authored `docs/site/public/` has to be carried into
 * it, or the logo silently 404s while every page still references it.
 */
function mirrorPublic() {
  const source = path.join(SITE_ROOT, "public");
  if (!fs.existsSync(source)) return;
  fs.cpSync(source, path.join(MIRROR_DIR, "public"), { recursive: true });
}

/** Where the hand-written HTTP contract lives, next to the Worker it describes. */
const API_SPEC = path.join(REPO_ROOT, "backend", "openapi.yaml");

/**
 * The OpenAPI document, served verbatim from the site root.
 *
 * Copied rather than transformed, and fetched by the API page at runtime rather
 * than bundled into it: what Swagger UI renders is then byte-for-byte the file
 * in the repository, and `/FantasyWiki/openapi.yaml` is a usable answer for
 * anyone who wants the spec itself rather than a page about it.
 *
 * Missing is not fatal. The mirror is also built by `npm run dev` on a working
 * tree someone may be halfway through, and a docs build has no business failing
 * over the backend.
 */
function mirrorApiSpec() {
  if (!fs.existsSync(API_SPEC)) {
    console.log("api      backend/openapi.yaml not found — the API page will say so");
    return;
  }
  fs.mkdirSync(path.join(MIRROR_DIR, "public"), { recursive: true });
  fs.copyFileSync(API_SPEC, path.join(MIRROR_DIR, "public", "openapi.yaml"));
}

function mirrorPages() {
  const entries = [];

  for (const absolute of walk(PAGES_DIR)) {
    const relative = toPosix(path.relative(PAGES_DIR, absolute));

    // Assembled from the others once they are all mirrored, so it is written by
    // `buildReport` rather than copied here — and kept out of the graph, where
    // a node linking to everything would say nothing about how the docs connect.
    if (relative === REPORT_SOURCE) continue;

    if (!absolute.endsWith(".md")) {
      fs.mkdirSync(path.dirname(path.join(MIRROR_DIR, relative)), { recursive: true });
      fs.copyFileSync(absolute, path.join(MIRROR_DIR, relative));
      continue;
    }

    const raw = fs.readFileSync(absolute, "utf8");
    const parsed = matter(raw);
    const data = {
      ...parsed.data,
      source: toPosix(path.join("docs/site/pages", relative)),
      tier: "site",
    };

    write(path.join(MIRROR_DIR, relative), matter.stringify(parsed.content, defined(data)));

    entries.push({
      id: relative,
      url: urlFor(relative),
      source: data.source,
      title: parsed.data.title ?? firstHeading(parsed.content) ?? relative,
      type: parsed.data.type ?? "guide",
      tags: parsed.data.tags ?? [],
      // A page whose space is prepared but not yet filled says so in its
      // frontmatter, so that "what is still unwritten" is a query rather than a
      // reading exercise.
      status: parsed.data.status,
      section: relative.includes("/") ? relative.split("/")[0] : "root",
      tier: "site",
      summary: parsed.data.description ?? summarise(parsed.content),
      words: wordCount(parsed.content),
      links: extractLinks(parsed.content),
      dir: path.posix.dirname(relative),
    });
  }

  return entries;
}

/**
 * Turns the mirrored files into a graph. Nodes are documents; edges are the
 * links between them, keeping the distinction between a curated `## Related`
 * edge and an incidental one made in passing. A link that resolves to nothing
 * is dropped here and caught by VitePress's dead-link check a moment later —
 * this pass is a reader of the tree, not its validator.
 */
function buildGraph(entries) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const edges = [];
  const seen = new Set();

  for (const entry of entries) {
    for (const link of entry.links) {
      if (/^(?:[a-z]+:|#)/i.test(link.target)) continue;

      const [pathPart] = link.target.split("#");
      if (!pathPart) continue;

      // A link to the same document can be written three ways depending on
      // where it appears: `.md` in the canonical tier, `.html` from an authored
      // page, and a bare directory for a section index. All three are the same
      // edge, so all three are normalised to the file the mirror holds.
      const asFile = pathPart.endsWith("/")
        ? `${pathPart}index.md`
        : pathPart.replace(/\.html$/, ".md");
      if (!asFile.endsWith(".md")) continue;

      const resolved = path.posix
        .normalize(path.posix.join(entry.dir, asFile))
        .replace(/(^|\/)README\.md$/, "$1index.md");

      if (!byId.has(resolved) || resolved === entry.id) continue;

      const key = `${entry.id}→${resolved}`;
      if (seen.has(key)) continue;
      seen.add(key);

      edges.push({ source: entry.id, target: resolved, related: link.related });
    }
  }

  const inbound = new Map(entries.map((entry) => [entry.id, 0]));
  const outbound = new Map(entries.map((entry) => [entry.id, 0]));
  for (const edge of edges) {
    inbound.set(edge.target, inbound.get(edge.target) + 1);
    outbound.set(edge.source, outbound.get(edge.source) + 1);
  }

  const nodes = entries.map((entry) => ({
    id: entry.id,
    url: entry.url,
    source: entry.source,
    title: entry.title,
    type: entry.type,
    tags: entry.tags,
    status: entry.status,
    section: entry.section,
    tier: entry.tier,
    summary: entry.summary,
    words: entry.words,
    updated: entry.updated,
    inbound: inbound.get(entry.id),
    outbound: outbound.get(entry.id),
  }));

  return {
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    stats: {
      documents: nodes.length,
      edges: edges.length,
      curated: edges.filter((edge) => edge.related).length,
      words: nodes.reduce((sum, node) => sum + node.words, 0),
      orphans: nodes
        .filter((node) => node.inbound === 0 && node.outbound === 0)
        .map((node) => node.id),
      hubs: [...nodes]
        .sort((a, b) => b.inbound + b.outbound - (a.inbound + a.outbound))
        .slice(0, 6)
        .map((node) => ({ id: node.id, title: node.title, url: node.url, degree: node.inbound + node.outbound })),
    },
  };
}

/**
 * The sidebar for the canonical tier is derived, not written down. A doc added
 * to `docs/` appears in the navigation on the next build with no second edit —
 * which is the whole reason the mirror exists.
 */
function buildToc(entries) {
  const canonical = entries.filter((entry) => entry.tier === "canonical" && entry.section !== "charter");

  const sections = Object.entries(SECTIONS).map(([key, meta]) => {
    const items = canonical
      .filter((entry) => entry.section === key)
      .sort((a, b) =>
        key === "adr" ? a.id.localeCompare(b.id) : a.title.localeCompare(b.title, "en"),
      )
      .map((entry) => ({ text: entry.title, link: entry.url }));

    return { key, text: meta.title, items };
  });

  return { sections: sections.filter((section) => section.items.length > 0) };
}

function main() {
  reset(MIRROR_DIR);
  reset(GENERATED_DIR);

  mirrorPublic();
  mirrorApiSpec();

  const modified = lastModifiedByPath();
  const entries = [...mirrorPages(), ...mirrorDocs(modified), ...mirrorCharter(modified)];

  const report = buildReport();
  const graph = buildGraph(entries);
  const toc = buildToc(entries);
  const coverage = collectCoverage();
  const api = collectApi();
  const glossary = collectGlossary();

  write(path.join(GENERATED_DIR, "graph.json"), `${JSON.stringify(graph, null, 2)}\n`);
  write(path.join(GENERATED_DIR, "toc.json"), `${JSON.stringify(toc, null, 2)}\n`);
  write(path.join(GENERATED_DIR, "coverage.json"), `${JSON.stringify(coverage, null, 2)}\n`);
  write(path.join(GENERATED_DIR, "api.json"), `${JSON.stringify(api, null, 2)}\n`);
  write(path.join(GENERATED_DIR, "glossary.json"), `${JSON.stringify(glossary, null, 2)}\n`);

  const measured = coverage.packages.filter((pkg) => pkg.measured).map((pkg) => pkg.id);
  console.log(
    [
      `mirror   ${entries.length} pages → ${toPosix(path.relative(SITE_ROOT, MIRROR_DIR))}/`,
      `graph    ${graph.stats.documents} nodes, ${graph.stats.edges} edges (${graph.stats.curated} curated)`,
      `coverage ${measured.length ? measured.join(", ") : "no reports found — the board will say so"}`,
      `api      ${api.present ? `${api.operations} operations in ${api.groups.length} groups` : "no spec found — the board will say so"}`,
      `glossary ${glossary.present ? `${glossary.terms.length} terms, ${glossary.withAvoid} with avoid lists` : "CONTEXT.md not found — the page will say so"}`,
      `report   ${report.present ? `${report.pages} pages in ${report.sections} sections` : "no report page to assemble"}`,
    ].join("\n"),
  );

  // A term written outside the glossary's own heading is parsed by nothing and
  // rendered by nothing, so it is reported here rather than silently missing.
  if (glossary.present && (glossary.stray > 0 || glossary.undefinedTerms.length > 0)) {
    console.log(
      `glossary ${glossary.stray} term(s) outside the Language section, ` +
        `${glossary.undefinedTerms.length} with no definition`,
    );
  }

  if (report.present && report.missing.length > 0) {
    console.log(`report   missing from the mirror: ${report.missing.join(", ")}`);
  }

  const planned = graph.nodes.filter((node) => node.status === "planned");
  if (planned.length > 0) {
    console.log(`planned  ${planned.map((node) => node.id).join(", ")}`);
  }

  if (graph.stats.orphans.length > 0) {
    console.log(`orphans  ${graph.stats.orphans.join(", ")}`);
  }
}

main();
