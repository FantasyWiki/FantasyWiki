declare namespace Cloudflare {
  interface Env {
    JWT_SECRET: string;
    GOOGLE_CLIENT_SECRET: string;
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
    /**
     * Declared so tests can swap the Article Genie's model out. They must: the
     * AI binding reaches remote Workers AI even under `vitest dev`, so a test
     * that left it in place would spend the day's neuron allocation.
     */
    AI: Ai;
  }
}
