import { WikimediaClient } from "../../external-apis/wikimedia/client";
import { Player } from "../../model";
import { Repositories } from "./repositories/repositories";

/**
 * What every handler reads off the Hono context instead of building for itself.
 * Both are injected once per request by the middleware in `index.ts`, which is
 * the only place the persistence target is chosen — so no route and no service
 * names a storage technology. The integration tests inject the same two through
 * `tests/support/target.ts`, which is what lets them run against any target.
 */
export type AppVariables = {
  repositories: Repositories;
  wikimedia: WikimediaClient;
};

/**
 * What a handler behind the `currentPlayer` middleware reads. Kept separate
 * from {@link AppVariables} because `player` is only there once that middleware
 * has run — the unauthenticated routes have no player to speak of.
 *
 * Only `currentPlayer` itself names this type. A router that declared it as its
 * own `Variables` would put `player` on the context of every route it carries,
 * guarded or not, and a route that forgot the middleware would then type-check
 * and answer 500 on the first dereference instead — which is exactly how
 * `my-performances` and `PUT /lineup` broke. Routers declare
 * {@link AppVariables} and let the middleware contribute `player` per route, so
 * omitting it is a compile error.
 */
export type AuthedVariables = AppVariables & { player: Player };
