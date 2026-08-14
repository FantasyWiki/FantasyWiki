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
 */
export type AuthedVariables = AppVariables & { player: Player };
