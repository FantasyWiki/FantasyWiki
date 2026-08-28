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
     * Both targets are named, so neither can leak upwards: a service that
     * reached for `repositories/mongo` would be as wrong as one reaching for
     * `repositories/d1`, and the rule that keeps the seam honest is the same
     * rule.
     *
     * The exempt test folders are the ones where naming a target is the
     * purpose: `tests/repositories/<target>` is where that store's own
     * behaviour is pinned, and `tests/support/<target>` is the seam the rest of
     * the suite goes through.
     *
     * SQL itself cannot be linted for, so it is not covered here. What keeps it
     * out of the tests is that `env.db` is the only way to reach it, and nothing
     * outside those folders imports it any more.
     */
    files: ["src/services/**/*.ts", "src/routes/**/*.ts", "src/tests/**/*.ts"],
    ignores: [
      "src/tests/repositories/d1/**",
      "src/tests/support/d1/**",
      "src/tests/repositories/mongo/**",
      "src/tests/support/mongo/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/repositories/d1/**",
                "**/repositories/d1",
                "**/repositories/mongo/**",
                "**/repositories/mongo",
              ],
              message:
                "Only composition.ts chooses an implementation. Services and routes take `Repositories`; tests reach it through `repositories()` in tests/support/target. Target-specific tests belong in tests/repositories/<target>.",
            },
          ],
        },
      ],
    },
  },
]);
