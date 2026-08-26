/// <reference types="vitest" />
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      env: {
        VITE_BACKEND_URL: "http://127.0.0.1:8787",
        VITE_MOCK: "true",
      },
      coverage: {
        provider: "v8",
        reporter: ["text", "json-summary", "lcov"],
        reportsDirectory: "coverage",
        include: ["src/**/*.{ts,vue}"],
        // No threshold here: Codecov gates the project total, and a second gate
        // in a second place is a second thing to keep in step.
        //
        // The mocks are the test harness, and `main.ts` is the bootstrap no
        // spec drives. Counting either would move the number without moving
        // what is actually tested.
        exclude: [
          "src/mocks/**",
          "src/tests/**",
          "src/main.ts",
          "src/**/*.d.ts",
        ],
      },
    },
  })
);
