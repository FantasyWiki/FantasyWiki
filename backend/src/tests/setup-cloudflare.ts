import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";
import { resetD1Database } from "./utils/d1TestUtils";

beforeEach(async () => {
  await resetD1Database(env.db);
});
