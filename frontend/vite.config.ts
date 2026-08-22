/// <reference types="vitest" />
import vue from "@vitejs/plugin-vue";
import path from "path";
import { defineConfig } from "vitest/config";

/**
 * Where the dev proxy forwards backend calls. The default is the Wrangler
 * default, for the ordinary case of both processes on this machine; under
 * Compose the two are separate containers, where `127.0.0.1` would be the
 * frontend itself, so the service name is passed in instead.
 */
const backendOrigin = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8787";

/**
 * Mirrors the Cloudflare Pages Functions proxy so local dev and deployed behave
 * identically. Only backend routes are forwarded: all of /api/* and all of
 * /internal/* (the scoring engine's bearer-guarded ingest surface), but under
 * /auth only /auth/google (the OAuth entry and Google's redirect target) and
 * /auth/dev. /auth/callback is a frontend SPA route — forwarding it sends it to
 * the backend, which 404s, so the SPA never loads to finish login.
 *
 * /auth/dev is the one entry with no counterpart in the deployed proxy, and
 * deliberately so: the backend refuses it outside the `local` environment, so
 * there would be nothing there to forward to.
 */
const backendProxy = {
  "/api": { target: backendOrigin, changeOrigin: true },
  "/internal": { target: backendOrigin, changeOrigin: true },
  "/auth/google": { target: backendOrigin, changeOrigin: true },
  "/auth/dev": { target: backendOrigin, changeOrigin: true },
};

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  plugins: [vue()],
  server: {
    // Bind every interface when asked to. Inside a container the default
    // loopback bind is unreachable through a published port, and the file
    // watcher has to poll because bind-mounted filesystems do not deliver
    // inotify events (docs/development/docker-local-dev.md).
    host: process.env.VITE_HOST ?? "localhost",
    watch: process.env.VITE_POLL === "true" ? { usePolling: true } : undefined,
    proxy: { ...backendProxy },
  },
  // `vite preview` serves the built bundle in the demo container. It needs the
  // same proxy — otherwise the SPA loads and every API call 404s — and the same
  // port, because FRONTEND_URL and the Google redirect URI both name 5173.
  preview: {
    host: process.env.VITE_HOST ?? "localhost",
    port: 5173,
    strictPort: true,
    proxy: { ...backendProxy },
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
