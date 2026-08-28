import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Checks that the built site links its own stylesheet.
 *
 * This gate exists because the site once published with none of it. VitePress
 * decides which file is *the* site stylesheet by taking the first CSS asset
 * Rollup emits:
 *
 *     output.find((chunk) => chunk.type === "asset" && chunk.fileName.endsWith(".css"))
 *
 * One CSS asset is the assumption. A `?url` CSS import anywhere in the theme
 * quietly adds a second, and if it sorts first every page links that one
 * instead — the theme uploads perfectly and is referenced by nothing.
 *
 * Nothing else notices. The markdown is valid, the links resolve, the diagrams
 * draw, the spec matches its routes, and the site goes out with no styling at
 * all. So the check is here: exactly one CSS asset, and every page links it.
 */

const DIST = fileURLToPath(new URL("../build/dist", import.meta.url));

function pages(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return pages(full);
    return entry.name.endsWith(".html") ? [full] : [];
  });
}

function fail(lines) {
  console.error(`styles   ${lines[0]}`);
  for (const line of lines.slice(1)) console.error(`  ${line}`);
  process.exit(1);
}

if (!fs.existsSync(DIST)) fail([`no build at ${DIST} — run the build first`]);

const assets = path.join(DIST, "assets");
const stylesheets = fs.existsSync(assets)
  ? fs.readdirSync(assets).filter((name) => name.endsWith(".css"))
  : [];

// More than one means the `find` above had a choice to make, and it is not
// worth trusting which way it went — this is the condition itself, not a
// symptom of it.
if (stylesheets.length !== 1) {
  fail([
    `expected exactly one stylesheet in assets/, found ${stylesheets.length}:`,
    ...stylesheets,
    "",
    "A second CSS asset makes VitePress link the wrong one site-wide.",
    "Serve the extra stylesheet from public/ instead of importing it with ?url",
    "— see mirrorSwaggerStylesheet in scripts/prepare.mjs.",
  ]);
}

const [stylesheet] = stylesheets;
const link = `assets/${stylesheet}`;
const unlinked = pages(DIST).filter((page) => !fs.readFileSync(page, "utf8").includes(link));

if (unlinked.length > 0) {
  fail([
    `${unlinked.length} of ${pages(DIST).length} pages do not link ${link}:`,
    ...unlinked.slice(0, 10).map((page) => path.relative(DIST, page)),
  ]);
}

// The other half of the same fix. Moving Swagger UI's stylesheet out of the
// bundle is what leaves `assets/` with one file, so if that copy ever stops
// happening the check above still passes — one stylesheet, every page links it
// — while the API page renders unstyled. Assert the copy landed.
const swagger = path.join(DIST, "swagger-ui.css");

if (!fs.existsSync(swagger) || fs.statSync(swagger).size < 10_000) {
  fail([
    "swagger-ui.css is missing from the site root, or is too small to be it.",
    "The API page links it at runtime and will render unstyled without it.",
    "See mirrorSwaggerStylesheet in scripts/prepare.mjs.",
  ]);
}

console.log(`styles   ${pages(DIST).length} pages link ${link}, swagger-ui.css served`);
