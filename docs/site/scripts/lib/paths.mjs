import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** `docs/site/` — the VitePress root, and the tooling half of the docs tree. */
export const SITE_ROOT = path.resolve(here, "..", "..");

/** `docs/` — the canonical documentation the site is a view of. */
export const DOCS_DIR = path.resolve(SITE_ROOT, "..");

/** The repository root. */
export const REPO_ROOT = path.resolve(DOCS_DIR, "..");

/** Authored, site-only pages: the orientation tier. */
export const PAGES_DIR = path.join(SITE_ROOT, "pages");

/**
 * Everything generated lives under `build/`, which the repository's root
 * `.gitignore` already excludes by name — the same convention Gradle uses for
 * the compiled module next door.
 */
export const BUILD_DIR = path.join(SITE_ROOT, "build");

/** The generated markdown tree VitePress reads. Never edit by hand. */
export const MIRROR_DIR = path.join(BUILD_DIR, "content");

/** Derived JSON (graph, coverage, sidebar) imported by the theme. */
export const GENERATED_DIR = path.join(BUILD_DIR, "data");

/** Where CI drops the coverage reports it downloads as artifacts. */
export const COVERAGE_INPUT_DIR = path.join(BUILD_DIR, "coverage-input");

export const GITHUB_REPO = "https://github.com/FantasyWiki/FantasyWiki";
export const GITHUB_BLOB = `${GITHUB_REPO}/blob/master`;

/**
 * Windows hands back `\` separators, Linux CI hands back `/`. Graph node ids
 * and link targets are compared as strings, so every path that becomes an id,
 * a URL, or a map key goes through here first — otherwise the graph renders as
 * a field of orphans on one platform and a graph on the other.
 */
export function toPosix(p) {
  return p.split(path.sep).join("/");
}

/**
 * The site URL a mirrored markdown file is served at, without `base`.
 *
 * `.html` is explicit rather than stripped: GitHub Pages does resolve
 * extensionless URLs, but a docs site whose every internal link depends on
 * that one host behaviour is a docs site that breaks the day it moves.
 */
export function urlFor(mirrorPath) {
  const withoutExtension = mirrorPath.replace(/\.md$/, "");
  if (withoutExtension === "index") return "/";
  if (withoutExtension.endsWith("/index")) return `/${withoutExtension.slice(0, -"index".length)}`;
  return `/${withoutExtension}.html`;
}
