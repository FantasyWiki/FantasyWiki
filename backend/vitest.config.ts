import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Every pool worker re-reads wrangler.jsonc, so each one repeats the same two
// wrangler notices — that `.dev.vars` was loaded, and that the rate limiters in
// `env.test` are `unsafe` bindings. Both are expected and neither says anything
// about the run, so keep wrangler quiet unless it has an actual error.
process.env.WRANGLER_LOG ??= "error";

const migrationsPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations",
);
const migrations = await readD1Migrations(migrationsPath);
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: "./wrangler.jsonc",
        // Mirrors `production` minus the Workers AI binding — see the comment on
        // that environment in wrangler.jsonc. AI has no local simulator, so its
        // presence makes the pool require Cloudflare credentials that CI does
        // not have.
        environment: "test",
      },
      miniflare: {
        d1Persist: false,
        bindings: {
          JWT_SECRET: "test-jwt-secret",
          GOOGLE_CLIENT_SECRET: "test-google-client-secret",
          SCORING_INGEST_SECRET: "test-scoring-secret",
          TEST_MIGRATIONS: migrations,
        },
      },
    }),
  ],
  test: {
    globals: true,
    testTimeout: 30000,
    include: ["src/**/*.integration.test.ts", "src/**/*.spec.ts"],
    setupFiles: [
      "./src/tests/apply-migrations.ts",
      "./src/tests/setup-cloudflare.ts",
    ],
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
});
