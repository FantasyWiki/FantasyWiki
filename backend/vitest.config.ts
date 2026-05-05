import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

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
      },
      miniflare: {
        d1Persist: false,
        bindings: {
          JWT_SECRET: "test-jwt-secret",
          GOOGLE_CLIENT_SECRET: "test-google-client-secret",
          TEST_MIGRATIONS: migrations.filter((migration) =>
            migration.name.startsWith("0001_"),
          ),
        },
      },
    }),
  ],
  test: {
    globals: true,
    testTimeout: 30000,
    include: ["src/**/*.integration.test.ts"],
    setupFiles: [
      "./src/tests/apply-migrations.ts",
      "./src/tests/setup-cloudflare.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts"],
    },
  },
});
