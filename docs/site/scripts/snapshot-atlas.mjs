import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { GENERATED_DIR, SITE_ROOT } from "./lib/paths.mjs";

/**
 * Renders the Docs Atlas to a standalone SVG.
 *
 * The Atlas on the site is interactive and therefore lives in a browser. A
 * printed report cannot open it, so this produces the same picture as a file —
 * from the same layout module, so the two can never disagree about where a
 * document sits.
 *
 *   node scripts/snapshot-atlas.mjs [out.svg]
 *
 * The output is deliberately not committed. It is a render of data that changes
 * every time a document does, and a checked-in copy would be stale the moment
 * anyone wrote a link.
 */

const requireFrom = createRequire(import.meta.url);
const esbuild = requireFrom("esbuild");

const LAYOUT = path.join(SITE_ROOT, ".vitepress", "theme", "atlasLayout.ts");
const OUT = process.argv[2] ?? path.join(SITE_ROOT, "atlas-snapshot.svg");

/** Light-mode section colours, mirroring the tokens in `theme/style.css`. */
const COLOURS = {
  domain: "#1e7e50",
  architecture: "#2f6f9e",
  adr: "#b4791f",
  development: "#7a5aa8",
  deployment: "#b45a3c",
  agents: "#5f7d8c",
  charter: "#4a6b57",
  guide: "#737f73",
  index: "#737f73",
};

const escape = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The layout is TypeScript and this is a plain script, so it is compiled on the
 * fly rather than duplicated. esbuild is already present as a Vite dependency.
 */
function loadLayout() {
  const source = fs.readFileSync(LAYOUT, "utf8").replace(/^import type .*$/m, "");
  const compiled = esbuild.transformSync(source, { loader: "ts", format: "cjs" }).code;
  const module_ = { exports: {} };
  new Function("module", "exports", compiled)(module_, module_.exports);
  return module_.exports;
}

function main() {
  const graphFile = path.join(GENERATED_DIR, "graph.json");
  if (!fs.existsSync(graphFile)) {
    console.error("No graph.json — run `npm run mirror` first.");
    process.exitCode = 1;
    return;
  }

  const graph = JSON.parse(fs.readFileSync(graphFile, "utf8"));
  const { layoutDocuments, boundsOf } = loadLayout();

  const placed = layoutDocuments(graph.nodes, graph.edges);
  const view = boundsOf(placed);
  const at = new Map(placed.map((node) => [node.id, node]));

  const edges = graph.edges
    .map((edge) => {
      const a = at.get(edge.source);
      const b = at.get(edge.target);
      if (!a || !b) return "";
      return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#5f6f62" stroke-width="1.1" stroke-opacity="${edge.related ? 0.42 : 0.16}"${edge.related ? "" : ' stroke-dasharray="3 4"'}/>`;
    })
    .filter(Boolean)
    .join("\n");

  const dots = placed
    .map((node) => {
      const colour = COLOURS[node.type] ?? COLOURS.guide;
      return [
        `<g transform="translate(${node.x.toFixed(1)} ${node.y.toFixed(1)})">`,
        `  <circle r="${node.radius.toFixed(1)}" fill="${colour}" fill-opacity="0.24" stroke="${colour}" stroke-width="1.8"/>`,
        `  <text y="${(node.radius + 14).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="600" fill="#4a564d" paint-order="stroke" stroke="#ffffff" stroke-width="3" stroke-linejoin="round">${escape(node.label)}</text>`,
        `</g>`,
      ].join("\n");
    })
    .join("\n");

  const sections = [...new Set(graph.nodes.map((node) => node.type))]
    .filter((type) => type !== "index")
    .sort();

  const legend = sections
    .map((type, index) => {
      const y = view.y + 26 + index * 19;
      return `<g transform="translate(${(view.x + 18).toFixed(1)} ${y.toFixed(1)})"><circle r="5" cy="-4" fill="${COLOURS[type] ?? COLOURS.guide}"/><text x="14" font-size="11" fill="#4a564d">${type}</text></g>`;
    })
    .join("\n");

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}" width="1200" font-family="'Source Sans 3', -apple-system, sans-serif">`,
    `<rect x="${view.x.toFixed(1)}" y="${view.y.toFixed(1)}" width="${view.w.toFixed(1)}" height="${view.h.toFixed(1)}" fill="#fbfbf7"/>`,
    edges,
    dots,
    legend,
    `</svg>`,
  ].join("\n");

  fs.writeFileSync(OUT, `${svg}\n`);
  console.log(
    `atlas    ${graph.nodes.length} documents, ${graph.edges.length} links → ${path.relative(SITE_ROOT, OUT)}`,
  );
}

main();
