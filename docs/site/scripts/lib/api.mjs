import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { REPO_ROOT } from "./paths.mjs";

/**
 * The shape of the HTTP surface, read from the spec that defines it.
 *
 * Nothing here is a second source of truth: every number is counted out of
 * `backend/openapi.yaml`, which the backend suite already gates against the
 * Worker's own route table. An endpoint added and documented moves these
 * figures on the next publish; an endpoint added and *not* documented never
 * reaches a build, because the suite fails first.
 *
 * A missing spec is reported as absent rather than as an empty API. The mirror
 * is also built by `npm run dev` against a tree someone may be halfway through,
 * and a docs build has no business failing over the backend.
 */

const SPEC = path.join(REPO_ROOT, "backend", "openapi.yaml");

const METHODS = ["get", "post", "put", "patch", "delete"];

/**
 * The three ways a caller proves who it is, keyed by the security scheme the
 * spec names. Which one applies is decided by the path prefix rather than by
 * the operation, so the prefix is what a reader recognises them by.
 */
const REGIMES = [
  {
    id: "session",
    scheme: "sessionCookie",
    prefix: "/api/*",
    note: "The frontend, as a signed-in player.",
  },
  {
    id: "service",
    scheme: "serviceToken",
    prefix: "/internal/*",
    note: "The scoring engine, which is not a person.",
  },
  {
    id: "open",
    scheme: null,
    prefix: "/auth/*",
    note: "Where a session is minted, and the deployment probe.",
  },
];

/**
 * Which regime an operation belongs to.
 *
 * Read off the operation's own `security`, falling back to the document
 * default — the same resolution a client would do, so a change to either is
 * reflected here without this file being told about it.
 */
function regimeOf(operation, documentDefault) {
  const security = operation.security ?? documentDefault ?? [];
  if (security.length === 0) return "open";
  const schemes = security.flatMap((requirement) => Object.keys(requirement));
  const match = REGIMES.find((regime) => regime.scheme && schemes.includes(regime.scheme));
  return match ? match.id : "open";
}

export function collectApi() {
  if (!fs.existsSync(SPEC)) return { present: false };

  const spec = parse(fs.readFileSync(SPEC, "utf8"));
  const documentDefault = spec.security;

  const groups = new Map();
  const methods = {};
  const regimes = Object.fromEntries(REGIMES.map((regime) => [regime.id, 0]));
  let operations = 0;

  for (const item of Object.values(spec.paths ?? {})) {
    for (const method of METHODS) {
      const operation = item[method];
      if (!operation) continue;

      operations += 1;
      methods[method.toUpperCase()] = (methods[method.toUpperCase()] ?? 0) + 1;
      regimes[regimeOf(operation, documentDefault)] += 1;

      // An operation carries one tag here, by convention rather than by the
      // format's rules: a group whose count is the number of operations *in* it
      // is a group a reader can add up, and one that double-counts is not.
      const tag = operation.tags?.[0] ?? "Untagged";
      const group = groups.get(tag) ?? { name: tag, operations: 0, methods: {} };
      group.operations += 1;
      group.methods[method.toUpperCase()] = (group.methods[method.toUpperCase()] ?? 0) + 1;
      groups.set(tag, group);
    }
  }

  // Tag order in the document is the author's running order — the surface as it
  // is meant to be read — so it is kept rather than sorted by size.
  const declared = (spec.tags ?? []).map((tag) => tag.name);
  const ordered = [
    ...declared.filter((name) => groups.has(name)).map((name) => groups.get(name)),
    ...[...groups.values()].filter((group) => !declared.includes(group.name)),
  ];

  return {
    present: true,
    title: spec.info?.title ?? "API",
    version: spec.info?.version ?? null,
    openapi: spec.openapi ?? null,
    operations,
    paths: Object.keys(spec.paths ?? {}).length,
    schemas: Object.keys(spec.components?.schemas ?? {}).length,
    methods,
    groups: ordered,
    regimes: REGIMES.map((regime) => ({
      id: regime.id,
      prefix: regime.prefix,
      note: regime.note,
      operations: regimes[regime.id],
    })),
  };
}
