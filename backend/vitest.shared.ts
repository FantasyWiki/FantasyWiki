import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import type { ViteUserConfig } from "vitest/config";

/**
 * The one description of how the backend suite runs, so the two targets differ
 * only in what they are pointed at.
 *
 * `vitest.config.ts` runs it against D1 and `vitest.mongo.config.ts` against
 * MongoDB; between them they share the pool, the Worker environment and the
 * setup file, because a second target is only worth running if it is running
 * the *same* suite (docs/development/backend-testing.md).
 */
export type PersistenceTarget = "d1" | "mongo";

// Every pool worker re-reads wrangler.jsonc, so each one repeats the same two
// wrangler notices — that `.dev.vars` was loaded, and that the rate limiters in
// `env.test` are `unsafe` bindings. Both are expected and neither says anything
// about the run, so keep wrangler quiet unless it has an actual error.
process.env.WRANGLER_LOG ??= "error";

const here = path.dirname(fileURLToPath(import.meta.url));

const migrationsPath = path.join(here, "migrations");

const MONGO_TEST_DATABASE = "fantasywiki_test";

/**
 * Where the Mongo suite talks to, and — failing that — a server for it to talk
 * to.
 *
 * `MONGO_URL` wins when it is set, so a developer with a container already up,
 * or a CI job with a service of its own, points at that. Otherwise one is
 * started here: `./gradlew check` runs this suite, and a check that only passes
 * on machines where someone remembered to `docker run` first is a check that
 * will quietly stop being run.
 *
 * A **replica set**, single-node, because the guarded writes are transactions
 * and a standalone `mongod` has none
 * (docs/architecture/persistence-targets.md).
 *
 * `vitest.globalSetup.ts` stops it when the run ends. A `mongod` left running
 * would hold the process open, and the library's own watcher — which kills it
 * once this process is gone — only unblocks that after Vitest has spent its
 * ten-second close timeout complaining.
 */
async function mongoUrl(): Promise<string> {
  const configured = process.env.MONGO_URL;
  if (configured) return configured;
  // `-core`, so installing the package downloads nothing: the ~220MB `mongod`
  // is fetched the first time a run actually needs one. Into a directory of our
  // own, because the default sits under `node_modules`, which `npm ci` deletes —
  // and re-downloading it on every lockfile change is the cost this avoids.
  process.env.MONGOMS_DOWNLOAD_DIR ??= path.join(here, ".cache", "mongodb");
  const { MongoMemoryReplSet } = await import("mongodb-memory-server-core");
  const server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  startedServer(server);
  return server.getUri(MONGO_TEST_DATABASE);
}

/**
 * The server this run started, if it started one.
 *
 * Parked on `globalThis` rather than in a module variable because the two
 * halves of its lifetime are loaded through different module graphs — Vite's
 * config loader reads this file, and the module runner reads the global setup —
 * so a module-level variable would give each of them its own copy and the
 * teardown would find nothing to stop.
 */
const STARTED = Symbol.for("fantasywiki.mongoTestServer");

type Stoppable = { stop(): Promise<unknown> };

function startedServer(server: Stoppable): void {
  (globalThis as Record<symbol, unknown>)[STARTED] = server;
}

export async function stopMongoServer(): Promise<void> {
  const global = globalThis as Record<symbol, unknown>;
  const server = global[STARTED] as Stoppable | undefined;
  delete global[STARTED];
  await server?.stop();
}

export async function backendTestConfig(
  target: PersistenceTarget,
): Promise<ViteUserConfig> {
  const migrations = await readD1Migrations(migrationsPath);
  const mongo = target === "mongo";

  return {
    plugins: [
      cloudflareTest({
        wrangler: {
          configPath: "./wrangler.jsonc",
          // Mirrors `production` minus the Workers AI binding — see the comment
          // on that environment in wrangler.jsonc. AI has no local simulator, so
          // its presence makes the pool require Cloudflare credentials that CI
          // does not have.
          environment: "test",
        },
        miniflare: {
          d1Persist: false,
          bindings: {
            JWT_SECRET: "test-jwt-secret",
            GOOGLE_CLIENT_SECRET: "test-google-client-secret",
            SCORING_INGEST_SECRET: "test-scoring-secret",
            TEST_MIGRATIONS: migrations,
            // Read by `repositoriesFor`, exactly as a deployment's would be, so
            // the suite cannot be pointed at a target production could not be.
            ...(mongo
              ? {
                  PERSISTENCE: "mongo",
                  MONGO_URL: await mongoUrl(),
                }
              : {}),
          },
        },
      }),
    ],
    test: {
      globals: true,
      // One file at a time against Mongo, because there is one Mongo. The D1
      // pool hands every test file its own database, so the suite is written as
      // if each file owned the store — `reset()` before every test, ids that
      // only have to be unique within a file. Sharing one server between
      // parallel files would have one file's reset wipe another's fixtures
      // mid-test.
      fileParallelism: !mongo,
      deps: {
        optimizer: {
          ssr: {
            // The Mongo driver is CommonJS, and the Workers pool cannot serve a
            // `require("node:x")` from inside one (its own known issue). Vite
            // pre-bundles it to ESM instead, with the builtins excluded so they
            // stay imports the runtime resolves rather than files rolldown
            // tries to read.
            enabled: true,
            include: ["mongodb"],
            exclude: [
              ...builtinModules,
              ...builtinModules.map((name) => `node:${name}`),
            ],
          },
        },
      },
      testTimeout: 30000,
      include: [
        "src/**/*.integration.test.ts",
        "src/**/*.spec.ts",
        // What is true of D1 and would not be asked of another target. The
        // Mongo run has no such tier of its own yet: everything it does is
        // answering the conformance suite.
        ...(mongo ? [] : ["src/**/*.d1.test.ts"]),
      ],
      setupFiles: ["./src/tests/setup.ts"],
      // Only the Mongo run has anything to tear down, and only when it started
      // the server itself.
      ...(mongo ? { globalSetup: ["./vitest.globalSetup.ts"] } : {}),
      coverage: {
        provider: "istanbul",
        reporter: ["text", "json-summary", "lcov"],
        reportsDirectory: "coverage",
        include: ["src/**/*.ts"],
        exclude: ["src/**/*.spec.ts", "src/routes/*"],
        thresholds: {
          statements: 0,
          branches: 0,
          lines: 0,
          functions: 0,
        },
      },
    },
  };
}
