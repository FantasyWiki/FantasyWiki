import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { app as deployedApp } from "../../index";
import { app as passwordApp } from "../../indexPassword";
import specSource from "../../../openapi.yaml?raw";

/**
 * The gate on `backend/openapi.yaml`.
 *
 * The spec is hand-written — the routes are plain Hono handlers with nothing on
 * them a generator could read — so the thing that keeps it true is this test
 * rather than a build step. It compares the *mounted* route table against the
 * documented operations in both directions, which catches the two ways a
 * hand-written spec goes wrong: a route added and never written down, and an
 * operation left behind by a route that was renamed or removed.
 *
 * What it deliberately does not check is whether an operation describes its
 * request and response correctly. No test can: the shapes are TypeScript
 * interfaces carrying Temporal values, which are strings on the wire and
 * classes in the code, so there is nothing to compare a schema to. Coverage of
 * the surface is what is mechanisable here, and it is the half that rots.
 */

interface OpenApiDocument {
  paths: Record<string, PathItem>;
  components: { schemas: Record<string, unknown> };
}

/**
 * `x-build` marks an operation that only one entry point mounts. Its value is
 * the build that has it — `mongo` for the username/password routes, which
 * `src/indexPassword.ts` mounts and the deployed Worker does not contain at all
 * (docs/architecture/auth-modes.md).
 */
type PathItem = Record<string, unknown> & { "x-build"?: string };

const MONGO_ONLY_BUILD = "mongo";

const spec = parse(specSource) as OpenApiDocument;

const DOCUMENTED_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "trace",
]);

/**
 * Hono writes a path parameter as `:id` and OpenAPI writes it as `{id}`. One
 * notation has to become the other or every parameterised path mismatches.
 */
function toOpenApiPath(honoPath: string): string {
  return honoPath.replace(/:([^/]+)/g, "{$1}");
}

/**
 * The operations an entry point actually serves.
 *
 * Two kinds of entry are dropped. `ALL` is how Hono registers middleware — the
 * CORS layer, the JWT guard, the `currentPlayer` resolver — and none of those
 * is an endpoint. `OPTIONS` is the CORS preflight, which is a property of the
 * transport rather than of the API, and documenting it on every path would say
 * the same thing thirty-three times.
 *
 * The result is a Set because a route registered with middleware appears once
 * per handler in the table: `leagues.get("/", currentPlayer, handler)` is two
 * entries for one endpoint.
 *
 * Takes the app rather than closing over one, because there are two entry
 * points and the difference between them is itself something to assert.
 */
function mountedOperations(app: { routes: RouteTable }): Set<string> {
  const operations = new Set<string>();
  for (const route of app.routes) {
    if (route.method === "ALL" || route.method === "OPTIONS") continue;
    operations.add(`${route.method} ${toOpenApiPath(route.path)}`);
  }
  return operations;
}

type RouteTable = readonly { method: string; path: string }[];

function documentedOperations(): Set<string> {
  const operations = new Set<string>();
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of Object.keys(item)) {
      if (!DOCUMENTED_METHODS.has(method)) continue;
      operations.add(`${method.toUpperCase()} ${path}`);
    }
  }
  return operations;
}

/** The documented operations that only the password build mounts. */
function mongoOnlyOperations(): Set<string> {
  const operations = new Set<string>();
  for (const [path, item] of Object.entries(spec.paths)) {
    if (item["x-build"] !== MONGO_ONLY_BUILD) continue;
    for (const method of Object.keys(item)) {
      if (!DOCUMENTED_METHODS.has(method)) continue;
      operations.add(`${method.toUpperCase()} ${path}`);
    }
  }
  return operations;
}

function sorted(operations: Iterable<string>): string[] {
  return [...operations].sort();
}

describe("openapi.yaml", () => {
  // Against the password entry, which mounts every route any build serves. The
  // deployed entry serves a subset, and the tests below are what pin down which.
  it("documents every endpoint the Worker serves", () => {
    const undocumented = sorted(mountedOperations(passwordApp)).filter(
      (operation) => !documentedOperations().has(operation),
    );

    expect(
      undocumented,
      "Add these to backend/openapi.yaml — they are mounted but undocumented.",
    ).toEqual([]);
  });

  it("documents no endpoint the Worker does not serve", () => {
    const phantom = sorted(documentedOperations()).filter(
      (operation) => !mountedOperations(passwordApp).has(operation),
    );

    expect(
      phantom,
      "Remove these from backend/openapi.yaml — they are documented but not mounted.",
    ).toEqual([]);
  });

  /**
   * Anti-vacuity, and the reason it earns its place: the two tests below both
   * pass trivially if `x-build` is misspelled, moved under the operation
   * instead of the path item, or dropped in a merge. Then nothing would be
   * build-specific, `mongoOnlyOperations()` would be empty, and the assertion
   * that the deployed entry serves no password route would be asserting
   * nothing at all.
   */
  it("marks the build-specific operations as build-specific", () => {
    expect(sorted(mongoOnlyOperations())).toEqual([
      "POST /auth/password/login",
      "POST /auth/password/register",
    ]);
  });

  it("keeps every build-specific operation out of the deployed entry", () => {
    const leaked = sorted(mountedOperations(deployedApp)).filter((operation) =>
      mongoOnlyOperations().has(operation),
    );

    expect(
      leaked,
      "src/index.ts is what Cloudflare deploys. These must not be reachable from it — check what it imports.",
    ).toEqual([]);
  });

  /**
   * The deployed Worker's surface, asserted as an equality rather than as a
   * subset: it catches a password route leaking into `src/index.ts`, which is
   * the thing that must never happen, and equally a route that reaches only
   * `src/indexPassword.ts` by accident.
   *
   * A route table is not a bundle — code can be imported without being mounted
   * — so this is not the whole guarantee. What it does hold is the line that
   * matters day to day (docs/architecture/auth-modes.md).
   */
  it("serves nothing but the shared surface from the deployed entry", () => {
    const mongoOnly = mongoOnlyOperations();
    const expected = sorted(mountedOperations(passwordApp)).filter(
      (operation) => !mongoOnly.has(operation),
    );

    expect(
      sorted(mountedOperations(deployedApp)),
      "src/index.ts is what Cloudflare deploys; it must mount every shared route and no build-specific one.",
    ).toEqual(expected);
  });

  /**
   * A `$ref` that resolves to nothing renders as an empty box in Swagger UI
   * rather than as an error, so a typo in a schema name is invisible on the
   * published page. Checked here because the documentation build cannot: it
   * serves this file verbatim and never parses it.
   */
  it("resolves every schema reference it makes", () => {
    const referenced = new Set(
      [...specSource.matchAll(/#\/components\/schemas\/([A-Za-z0-9_]+)/g)].map(
        (match) => match[1],
      ),
    );
    const defined = new Set(Object.keys(spec.components.schemas));

    const dangling = sorted(referenced).filter((name) => !defined.has(name));
    expect(dangling, "No such schema in components.schemas.").toEqual([]);

    const unused = sorted(defined).filter((name) => !referenced.has(name));
    expect(unused, "Defined but never referenced.").toEqual([]);
  });
});
