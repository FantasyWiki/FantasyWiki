import fs from "node:fs";
import path from "node:path";
import { COVERAGE_INPUT_DIR, REPO_ROOT } from "./paths.mjs";

/**
 * Three test suites, three report formats, one board. The numbers are read
 * wherever they happen to be: in CI the coverage jobs upload their reports and
 * the docs job downloads them into `COVERAGE_DIR`; on a laptop the reports sit
 * where each tool wrote them. A package with no report is reported as
 * unmeasured rather than as zero — an absent number and a bad number are not
 * the same claim.
 */

const inputDir = process.env.COVERAGE_DIR
  ? path.resolve(process.env.COVERAGE_DIR)
  : COVERAGE_INPUT_DIR;

const PACKAGES = [
  {
    id: "backend",
    name: "Backend",
    runtime: "Cloudflare Worker · TypeScript",
    format: "istanbul",
    note: "Routes are excluded from the report: they are covered end to end by the integration tier, which drives them through real HTTP.",
    candidates: [
      path.join(inputDir, "backend", "coverage-summary.json"),
      path.join(REPO_ROOT, "backend", "coverage", "coverage-summary.json"),
    ],
  },
  {
    id: "frontend",
    name: "Frontend",
    runtime: "Vue 3 + Ionic · TypeScript",
    format: "istanbul",
    note: "The lowest of the three, and expected to be. Frontend specs are regression smoke around stores, services and views; the game rules they would otherwise re-assert are tested where they live, in the backend. Mocks, the bootstrap and the specs themselves are excluded.",
    candidates: [
      path.join(inputDir, "frontend", "coverage-summary.json"),
      path.join(REPO_ROOT, "frontend", "coverage", "coverage-summary.json"),
    ],
  },
  {
    id: "scoring-collector",
    name: "Scoring Collector",
    runtime: "JVM · Kotlin",
    format: "kover",
    note: "The nightly batch. Kover counts the whole module, including the Wikimedia dump parsing that carries most of its risk.",
    candidates: [
      path.join(inputDir, "scoring-collector", "report.xml"),
      path.join(REPO_ROOT, "scoring-collector", "build", "reports", "kover", "report.xml"),
    ],
  },
];

function firstExisting(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function readIstanbul(file) {
  const summary = JSON.parse(fs.readFileSync(file, "utf8"));
  const total = summary.total;
  if (!total) return undefined;

  const metric = (key) => ({
    covered: total[key].covered,
    total: total[key].total,
    pct: total[key].total === 0 ? 0 : round(total[key].pct),
  });

  return {
    lines: metric("lines"),
    statements: metric("statements"),
    branches: metric("branches"),
    functions: metric("functions"),
    files: Object.keys(summary).filter((key) => key !== "total").length,
  };
}

/**
 * Kover's XML is JaCoCo's: a flat list of `<counter>` elements at the end of
 * the report, whose last occurrences are the module totals. Parsing it with a
 * regex rather than an XML dependency is a deliberate trade — the shape is
 * fixed by the JaCoCo schema, and the alternative is a parser in the tree for
 * one file.
 */
function readKover(file) {
  const xml = fs.readFileSync(file, "utf8");
  const counters = new Map();

  for (const match of xml.matchAll(
    /<counter\s+type="(\w+)"\s+missed="(\d+)"\s+covered="(\d+)"\s*\/>/g,
  )) {
    const [, type, missed, covered] = match;
    counters.set(type, { missed: Number(missed), covered: Number(covered) });
  }

  const metric = (type) => {
    const counter = counters.get(type);
    if (!counter) return { covered: 0, total: 0, pct: 0 };
    const total = counter.covered + counter.missed;
    return { covered: counter.covered, total, pct: total === 0 ? 0 : round((counter.covered / total) * 100) };
  };

  if (counters.size === 0) return undefined;

  return {
    lines: metric("LINE"),
    statements: metric("INSTRUCTION"),
    branches: metric("BRANCH"),
    functions: metric("METHOD"),
    files: undefined,
  };
}

function round(value) {
  return Math.round(value * 10) / 10;
}

export function collectCoverage() {
  const packages = PACKAGES.map((pkg) => {
    const file = firstExisting(pkg.candidates);
    if (!file) {
      return { id: pkg.id, name: pkg.name, runtime: pkg.runtime, note: pkg.note, measured: false };
    }

    const metrics = pkg.format === "kover" ? readKover(file) : readIstanbul(file);
    if (!metrics) {
      return { id: pkg.id, name: pkg.name, runtime: pkg.runtime, note: pkg.note, measured: false };
    }

    return {
      id: pkg.id,
      name: pkg.name,
      runtime: pkg.runtime,
      note: pkg.note,
      measured: true,
      ...metrics,
    };
  });

  const measured = packages.filter((pkg) => pkg.measured);
  const coveredLines = measured.reduce((sum, pkg) => sum + pkg.lines.covered, 0);
  const totalLines = measured.reduce((sum, pkg) => sum + pkg.lines.total, 0);

  return {
    generatedAt: new Date().toISOString(),
    gate: 70,
    combined: totalLines === 0 ? undefined : { covered: coveredLines, total: totalLines, pct: round((coveredLines / totalLines) * 100) },
    packages,
  };
}
