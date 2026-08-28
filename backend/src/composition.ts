import { Repositories } from "./repositories/repositories";
import { d1Repositories } from "./repositories/d1";
import { mongoRepositories, type MongoTarget } from "./repositories/mongo";

/**
 * How a deployment says which store it is running on. Absent — every Cloudflare
 * environment today — means D1.
 */
export const MONGO_PERSISTENCE = "mongo";

/**
 * The bindings {@link repositoriesFor} reads. `db` is optional because a Mongo
 * deployment has no D1 database bound at all, and `MONGO_URL` because a D1 one
 * has no connection string.
 */
export interface PersistenceEnv {
  PERSISTENCE?: string;
  db?: D1Database;
  MONGO_URL?: string;
  /** Overrides the database named in the connection string's path. */
  MONGO_DB?: string;
}

/**
 * The one place that picks a persistence implementation. Every entry point
 * comes through here: the request pipeline in `index.ts`, whose middleware puts
 * the result on the context; the settlement Workflow, which the runtime
 * constructs with its own `env` and so cannot be handed repositories from
 * outside; and `tests/support/target.ts`, the suite's mirror of this function.
 * Routes and services only ever receive the result.
 *
 * A deployment runs on exactly one of the two. Which one is a binding —
 * `PERSISTENCE=mongo` with a `MONGO_URL` — so the same build serves both and
 * nothing above this line has to know which it got. That is what lets the
 * integration suite stand as the Mongo target's acceptance criteria: it runs
 * unchanged, against the same interfaces, with this function answering
 * differently.
 *
 * Synchronous, and it has to stay that way: two of its three callers cannot
 * await it. The Workflow builds its services inside a constructor-shaped
 * override, and the test seam is a plain `repositories()` that every test file
 * calls without awaiting. So the Mongo repositories are built eagerly around a
 * *target* and open their connection on the first call that needs one, rather
 * than being handed a live client. The driver still stays out of a D1
 * deployment: nothing under `repositories/mongo` imports it for its value
 * except the one `await import("mongodb")` that opens a connection.
 */
export function repositoriesFor(env: PersistenceEnv): Repositories {
  if (env.PERSISTENCE === MONGO_PERSISTENCE) {
    return mongoRepositories(mongoTargetFor(env));
  }
  // Deliberately not checked. Whether a `db` binding is present is a
  // deployment's business, and the app is startable without one — the routes
  // that never reach persistence answer perfectly well, which is what
  // `tests/routes/index.spec.ts` drives. A missing binding surfaces on the
  // first query, as it did before there was a second target to choose from.
  return d1Repositories(env.db as D1Database);
}

/**
 * Where a Mongo deployment's data is, from its bindings — shared with the
 * suite's own store, so "PERSISTENCE=mongo without a MONGO_URL" is one
 * misconfiguration with one message rather than two.
 */
export function mongoTargetFor(env: PersistenceEnv): MongoTarget {
  if (!env.MONGO_URL) {
    throw new Error(
      "PERSISTENCE=mongo needs a MONGO_URL binding to connect to.",
    );
  }
  return { url: env.MONGO_URL, database: env.MONGO_DB };
}
