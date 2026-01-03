import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import {
  defineConfigWithVueTs,
  vueTsConfigs,
} from "@vue/eslint-config-typescript";

export default defineConfigWithVueTs(
  ...pluginVue.configs["flat/essential"],
  vueTsConfigs.recommended,

  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
      "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
      "vue/no-deprecated-slot-attribute": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: [
      "**/.DS_Store",
      "**/node_modules/",
      "dist/",
      "coverage/",
      "ios/",
      "android/",
      "**/.env.local",
      "**/.env.*.local",
      "**/npm-debug.log*",
      "**/yarn-debug.log*",
      "**/yarn-error.log*",
      "**/pnpm-debug.log*",
      "**/.idea/",
      "**/.vscode/",
      "**/*.suo",
      "**/*.ntvs*",
      "**/*.njsproj",
      "**/*.sln",
      "**/*.sw?",
    ],
  }
);
