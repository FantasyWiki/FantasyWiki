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
    /**
     * How the suite says which store it is running against, read by
     * `repositoriesFor` exactly as a deployment's binding would be. Only
     * `vitest.mongo.config.ts` binds them; the D1 run leaves them undefined.
     */
    PERSISTENCE?: string;
    MONGO_URL?: string;
    MONGO_DB?: string;
  }
}
