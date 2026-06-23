import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import vueI18n from "@intlify/eslint-plugin-vue-i18n";
import { defineConfig } from "eslint/config";
import { includeIgnoreFile } from "@eslint/compat";
import { fileURLToPath } from "node:url";

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url));

export default defineConfig([
  includeIgnoreFile(gitignorePath),
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,
  pluginVue.configs["flat/essential"],
  // i18n translation integrity. Build on flat/base (plugin + locale-resource
  // wiring only) and opt into exactly the two rules we want as errors, instead
  // of flat/recommended's broader `warn` set (e.g. no-raw-text):
  //   - no-missing-keys: a t("…")/<i18n-t> key used in code is absent from a catalog.
  //   - no-unused-keys:  a key defined in a catalog is never referenced.
  // The catalogs are JSON (en.json is the schema of record; schema.ts re-asserts
  // it.json against it at compile time), since these rules can only read JSON/YAML.
  ...vueI18n.configs["flat/base"],
  {
    // Shared locale-resource location for both rules below.
    files: ["**/*.{vue,ts}", "src/i18n/locales/*.json"],
    settings: {
      "vue-i18n": {
        localeDir: "./src/i18n/locales/*.json",
      },
    },
  },
  {
    // no-missing-keys reports on the source that references an undefined key.
    files: ["**/*.{vue,ts}"],
    rules: {
      "@intlify/vue-i18n/no-missing-keys": "error",
    },
  },
  {
    // no-unused-keys reports on the catalog that defines an unreferenced key.
    // Its source scan defaults to .js/.vue only — add .ts so keys used solely in
    // composables/stores (e.g. useI18n().t(...) in a Pinia store) aren't flagged.
    files: ["src/i18n/locales/*.json"],
    rules: {
      "@intlify/vue-i18n/no-unused-keys": [
        "error",
        { src: "./src", extensions: [".js", ".ts", ".vue"] },
      ],
    },
  },
  {
    files: ["**/*.vue"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
    rules: {
      "vue/no-deprecated-slot-attribute": "off",
    },
  },
]);
