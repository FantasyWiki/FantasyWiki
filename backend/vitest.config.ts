import { defineConfig } from "vitest/config";
import { backendTestConfig } from "./vitest.shared";

/** The default target: D1, the store every Cloudflare environment runs on. */
export default defineConfig(await backendTestConfig("d1"));
