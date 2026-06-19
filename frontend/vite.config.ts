/// <reference types="vitest" />
import vue from "@vitejs/plugin-vue";
import path from "path";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  plugins: [vue()],
  server: {
    proxy: {
      // Mirror the Cloudflare Pages Functions proxy so local dev and deployed
      // behave identically: all /api/* and /auth/* requests go to the backend.
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/auth": { target: "http://127.0.0.1:8787", changeOrigin: true },
    },
  },
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
