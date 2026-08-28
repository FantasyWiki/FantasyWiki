import { env } from "cloudflare:workers";
import {
  MONGO_PERSISTENCE,
  mongoTargetFor,
  repositoriesFor,
  type PersistenceEnv,
} from "../../composition";
import { Repositories } from "../../repositories/repositories";
import { D1TestStore } from "./d1/d1TestStore";
import { perFileDatabase } from "./mongo/database";
import { MongoTestStore } from "./mongo/mongoTestStore";
import { TestStore } from "./testStore";

/**
 * The persistence target under test. This is the only module in the test tree
 * that names one: everything above it sees `Repositories` and `TestStore`, so
 * the same suite runs against either implementation without a test file
 * changing.
 *
 * Which one it is comes from the same `PERSISTENCE` binding production reads,
 * through the same `repositoriesFor` — so the suite cannot be pointed at a
 * combination a deployment could not also be. `vitest.config.ts` binds nothing
 * and gets D1; `vitest.mongo.config.ts` binds `PERSISTENCE` and `MONGO_URL`.
 *
 * The bundle cannot be a Worker binding — bindings are built from
 * JSON-serializable values in the vitest config, while the repositories need
 * handles that only exist inside the isolate.
 *
 * Both are built once per isolate rather than per call, which the suite calls
 * them thousands of times. For D1 that is merely tidy — every set wraps the same
 * `env.db`. For Mongo it is what keeps the run to one connection: a `MongoStore`
 * holds one, deliberately, because in a Worker a socket may not outlive the
 * request that opened it, and a test file is not a request.
 */
let built: Repositories | undefined;
let resetter: TestStore | undefined;

/**
 * The bindings, with this file's own database named on them the first time
 * anything asks (see {@link perFileDatabase}). That is what lets the files run
 * in parallel against a single server.
 *
 * Written *onto* the bindings rather than passed alongside them, because this
 * seam is not the only reader. `tests/routes/internal.integration.test.ts`
 * drives the wired app, whose middleware calls `repositoriesFor(c.env)`, and
 * the settlement Workflow test calls `repositoriesFor(this.env)` itself. Those
 * have to reach the same database as the fixtures, and the only thing all three
 * share is `env`. A binding is also what a deployment would use to say the same
 * thing, so nothing here asks the code under test to know it is a test.
 *
 * Set once per isolate, which is once per test file — a fresh isolate arrives
 * with it undefined.
 */
const persistenceEnv = (): PersistenceEnv => {
  if (env.PERSISTENCE === MONGO_PERSISTENCE && env.MONGO_DB === undefined) {
    (env as { MONGO_DB?: string }).MONGO_DB = perFileDatabase();
  }
  return env;
};

export const repositories = (): Repositories =>
  (built ??= repositoriesFor(persistenceEnv()));

export const store = (): TestStore =>
  (resetter ??=
    env.PERSISTENCE === MONGO_PERSISTENCE
      ? new MongoTestStore(mongoTargetFor(persistenceEnv()))
      : new D1TestStore(env.db, env.TEST_MIGRATIONS));
