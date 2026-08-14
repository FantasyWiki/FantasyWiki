import { Repositories } from "./repositories/repositories";
import { d1Repositories } from "./repositories/d1";

/**
 * The one place that picks a persistence implementation. Both entry points come
 * through here: the request pipeline in `index.ts`, whose middleware puts the
 * result on the context, and the settlement Workflow, which the runtime
 * constructs with its own `env` and so cannot be handed repositories from
 * outside. Routes and services only ever receive the result.
 *
 * A second target — MongoDB is the one this seam was built for — is added by
 * implementing every interface in `repositories/` under `repositories/mongo/`
 * plus a `mongoRepositories(...)` mirroring `repositories/d1/index.ts`, then
 * branching here on whatever binding names the target:
 *
 * ```ts
 * export async function repositoriesFor(env: Bindings): Promise<Repositories> {
 *   if (env.PERSISTENCE === "mongo") {
 *     // Dynamic, so the driver stays out of the bundle that deploys with D1:
 *     // a plain top-level import would pull it into both.
 *     const { mongoRepositories } = await import("./repositories/mongo");
 *     return mongoRepositories(env.MONGO_URL);
 *   }
 *   return d1Repositories(env.db);
 * }
 * ```
 *
 * Both callers would then await it, and `tests/support/target.ts` — the mirror
 * of this function for the suite — would read the same binding, which is what
 * lets the existing integration tests stand as the new implementation's
 * acceptance criteria.
 */
export function repositoriesFor(env: { db: D1Database }): Repositories {
  return d1Repositories(env.db);
}
