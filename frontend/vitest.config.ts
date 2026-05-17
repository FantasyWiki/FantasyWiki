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
    },
  })
);
