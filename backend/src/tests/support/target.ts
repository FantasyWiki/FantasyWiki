import { env } from "cloudflare:workers";
import { d1Repositories } from "../../repositories/d1";
import { Repositories } from "../../repositories/repositories";
import { D1TestStore } from "./d1/d1TestStore";
import { TestStore } from "./testStore";

/**
 * The persistence target under test. This is the only module in the test tree
 * that names one: everything above it sees `Repositories` and `TestStore`, so
 * the same suite runs against a second implementation by changing this file
 * alone.
 *
 * The bundle cannot be a Worker binding — bindings are built from
 * JSON-serializable values in `vitest.config.ts`, while `d1Repositories` needs
 * the `D1Database` handle that only exists inside the isolate.
 */
export const repositories = (): Repositories => d1Repositories(env.db);

export const store = (): TestStore =>
  new D1TestStore(env.db, env.TEST_MIGRATIONS);
