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
      // behave identically. Only backend routes are proxied: all of /api/* and
      // all of /internal/* (the scoring engine's bearer-guarded ingest surface),
      // but under /auth only /auth/google (the OAuth entry + Google's redirect
      // target). /auth/callback is a frontend SPA route — proxying it sends it
      // to the backend, which 404s, so the SPA never loads to finish login.
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/internal": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/auth/google": { target: "http://127.0.0.1:8787", changeOrigin: true },
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
