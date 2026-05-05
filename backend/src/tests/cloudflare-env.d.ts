declare namespace Cloudflare {
  interface Env {
    JWT_SECRET: string;
    GOOGLE_CLIENT_SECRET: string;
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
