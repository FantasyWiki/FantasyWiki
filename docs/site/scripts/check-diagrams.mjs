import fs from "node:fs";
import path from "node:path";
import { MIRROR_DIR, toPosix } from "./lib/paths.mjs";

/**
 * Renders every mermaid diagram in the mirror.
 *
 * Diagrams are drawn in the browser, which means a broken one costs nothing at
 * build time and shows up on the published page as a box saying the diagram
 * failed. Nothing else in the pipeline would catch it: the markdown is valid,
 * the links resolve, and the build goes green.
 *
 * So the diagrams get their own gate -- and it renders rather than parses.
 * Parsing only proves the grammar is satisfied; a diagram can parse cleanly and
 * still fail while being laid out, which is exactly the failure this gate exists
 * to catch. Rendering headlessly needs a DOM and the handful of SVG measurement
 * methods jsdom does not implement, both of which are set up below.
 */

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return full.endsWith(".md") ? [full] : [];
  });
}

/**
 * Every ```mermaid fence in a file, with the line it opens on. Non-mermaid
 * fences are still tracked, so that a `mermaid` word inside a shell sample
 * cannot be mistaken for the start of a diagram.
 */
function diagramsIn(file) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const diagrams = [];
  let open = null;

  for (const [index, line] of lines.entries()) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      if (open) {
        if (open.body) diagrams.push({ line: open.line, source: open.body.join("\n") });
        open = null;
      } else {
        const isMermaid = /^\s*(?:```|~~~)\s*mermaid\s*$/.test(line);
        open = { line: index + 1, body: isMermaid ? [] : undefined };
      }
      continue;
    }
    open?.body?.push(line);
  }

  return diagrams.filter((diagram) => diagram.source.trim().length > 0);
}

/**
 * Mermaid sanitises HTML labels with DOMPurify, which needs a window. Without
 * one it degrades to a stub and every diagram carrying a `<b>` or a `<small>`
 * fails for a reason that has nothing to do with the diagram. A jsdom window
 * makes this check the same one the browser performs.
 */
async function installDom() {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  globalThis.window ??= dom.window;
  globalThis.document ??= dom.window.document;
  globalThis.DOMPurify ??= dom.window.DOMPurify;
  globalThis.Node ??= dom.window.Node;
  globalThis.Element ??= dom.window.Element;
  globalThis.HTMLElement ??= dom.window.HTMLElement;
  globalThis.SVGElement ??= dom.window.SVGElement;
  globalThis.DocumentFragment ??= dom.window.DocumentFragment;
  globalThis.NodeFilter ??= dom.window.NodeFilter;
  globalThis.getComputedStyle ??= dom.window.getComputedStyle;

  // jsdom has no layout engine, so every measurement mermaid takes comes back
  // undefined and the renderer does arithmetic on it. Stubbing them makes the
  // geometry meaningless -- every box is this size -- which is fine, because
  // what is under test is whether a diagram draws at all, not where its corners
  // land.
  const box = { x: 0, y: 0, width: 140, height: 40, top: 0, left: 0, right: 140, bottom: 40 };
  dom.window.SVGElement.prototype.getBBox = () => ({ ...box });
  dom.window.SVGElement.prototype.getComputedTextLength = () => box.width;
  dom.window.SVGElement.prototype.getScreenCTM = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  dom.window.Element.prototype.getBoundingClientRect = () => ({ ...box, toJSON: () => box });
}

async function main() {
  await installDom();
  const mermaid = (await import("mermaid")).default;
  // The same settings `Mermaid.vue` initialises with, because a diagram that
  // parses under different options is not the diagram the page will draw.
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    fontFamily: '"Source Sans 3", -apple-system, sans-serif',
    flowchart: { curve: "basis", htmlLabels: true, padding: 12 },
    sequence: { actorMargin: 24, boxMargin: 8, mirrorActors: false },
    gantt: { fontSize: 12 },
  });

  const failures = [];
  let total = 0;

  for (const file of walk(MIRROR_DIR)) {
    for (const diagram of diagramsIn(file)) {
      total += 1;
      const where = {
        file: toPosix(path.relative(MIRROR_DIR, file)),
        line: diagram.line,
      };

      try {
        const { svg } = await mermaid.render(`check-${total}`, diagram.source);

        // A failure can come back as a drawn apology rather than a rejection,
        // which on the page is the same thing as a crash: a box where a diagram
        // should be.
        if (!svg || !svg.includes("<svg")) {
          failures.push({ ...where, reason: "rendered nothing" });
        } else if (/aria-roledescription="error"|>Syntax error in text</.test(svg)) {
          failures.push({ ...where, reason: "rendered mermaid's own error graphic" });
        }
      } catch (cause) {
        failures.push({
          ...where,
          reason: (cause instanceof Error ? cause.message : String(cause)).split("\n")[0],
        });
      }
    }
  }

  if (failures.length === 0) {
    console.log(`diagrams ${total} rendered`);
    return;
  }

  console.error(`diagrams ${failures.length} of ${total} failed to render:\n`);
  for (const failure of failures) {
    console.error(`  ${failure.file}:${failure.line} — ${failure.reason}`);
  }
  process.exitCode = 1;
}

await main();
