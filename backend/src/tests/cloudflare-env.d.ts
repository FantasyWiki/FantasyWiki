declare namespace Cloudflare {
  interface Env {
    JWT_SECRET: string;
    GOOGLE_CLIENT_SECRET: string;
    WORKERS_CI_BRANCH: string;
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
