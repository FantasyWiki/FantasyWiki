/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { beforeEach } from "vitest";
import { store } from "./support/target";

// Every test starts from the migrations' own baseline: the schema plus the
// Global League and its system admin player (0002_seed_global_league).
beforeEach(async () => {
  await store().reset();
});
