import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: [
      ".wrangler/**",
      "node_modules/**",
      "build/**",
      "src/tests/cloudflare-env.d.ts",
      "coverage/**",
    ],
  },
  {
    files: ["src/**/*.{js,mjs,cjs,ts,mts,cts}", "eslint.config.ts"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,
  {
    /**
     * The one rule that keeps the persistence target replaceable, made
     * mechanical (#534): `composition.ts` is the only module that may name an
     * implementation. Everything above it — services, routes, and the tests of
     * both — sees the `Repositories` interfaces and nothing under them.
     *
     * Two test folders are exempt because naming D1 is their purpose:
     * `tests/repositories/d1` is where D1's own behaviour is pinned, and
     * `tests/support/d1` is the target seam the rest of the suite goes through.
     *
     * SQL itself cannot be linted for, so it is not covered here. What keeps it
     * out of the tests is that `env.db` is the only way to reach it, and nothing
     * outside those two folders imports it any more.
     */
    files: ["src/services/**/*.ts", "src/routes/**/*.ts", "src/tests/**/*.ts"],
    ignores: ["src/tests/repositories/d1/**", "src/tests/support/d1/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/repositories/d1/**", "**/repositories/d1"],
              message:
                "Only composition.ts chooses an implementation. Services and routes take `Repositories`; tests reach it through `repositories()` in tests/support/target. D1-specific tests belong in tests/repositories/d1.",
            },
          ],
        },
      ],
    },
  },
]);
