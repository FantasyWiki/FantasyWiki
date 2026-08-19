import { defineConfig } from "vitest/config";
import { backendTestConfig } from "./vitest.shared";

/**
 * The same suite, against MongoDB. Needs a replica set to talk to — see
 * docs/development/backend-testing.md — and skips the D1 tier, which exists to
 * pin facts about D1 rather than about a repository's callers.
 */
export default defineConfig(await backendTestConfig("mongo"));
