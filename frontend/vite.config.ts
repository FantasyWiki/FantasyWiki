/// <reference types="vitest" />
import vue from "@vitejs/plugin-vue";
import path from "path";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@js-temporal/polyfill": new URL(
        "../frontend/node_modules/@js-temporal/polyfill",
        import.meta.url
      ).pathname,
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/tests/setup.ts",
  },
  build: {
    sourcemap: true,
  },
});
