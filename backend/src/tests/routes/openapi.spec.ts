import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { app } from "../../index";
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
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown> };
}

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
 * The operations the Worker actually serves.
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
 */
function mountedOperations(): Set<string> {
  const operations = new Set<string>();
  for (const route of app.routes) {
    if (route.method === "ALL" || route.method === "OPTIONS") continue;
    operations.add(`${route.method} ${toOpenApiPath(route.path)}`);
  }
  return operations;
}

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

function sorted(operations: Iterable<string>): string[] {
  return [...operations].sort();
}

describe("openapi.yaml", () => {
  it("documents every endpoint the Worker serves", () => {
    const undocumented = sorted(mountedOperations()).filter(
      (operation) => !documentedOperations().has(operation),
    );

    expect(
      undocumented,
      "Add these to backend/openapi.yaml — they are mounted but undocumented.",
    ).toEqual([]);
  });

  it("documents no endpoint the Worker does not serve", () => {
    const phantom = sorted(documentedOperations()).filter(
      (operation) => !mountedOperations().has(operation),
    );

    expect(
      phantom,
      "Remove these from backend/openapi.yaml — they are documented but not mounted.",
    ).toEqual([]);
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
