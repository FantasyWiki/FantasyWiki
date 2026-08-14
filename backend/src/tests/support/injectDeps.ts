import { createMiddleware } from "hono/factory";
import { WikimediaClient } from "../../../../external-apis/wikimedia/client";
import { AppVariables } from "../../appEnv";
import { repositories } from "./target";

/**
 * What the middleware in `index.ts` does, for tests that mount a router on
 * their own app instead of driving the wired one: put the repositories on the
 * context so the handlers behind it can build their services.
 */
export function injectDeps(overrides: Partial<AppVariables> = {}) {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    c.set("repositories", overrides.repositories ?? repositories());
    c.set("wikimedia", overrides.wikimedia ?? absentWikimedia());
    return next();
  });
}

/**
 * Wikimedia is a network call, so a test that reaches it has to say so by
 * passing its own stub. This one fails loudly rather than letting a route
 * silently hit the live API.
 */
function absentWikimedia(): WikimediaClient {
  return new Proxy({} as WikimediaClient, {
    get(_target, property) {
      throw new Error(
        `This test did not inject a WikimediaClient, but the route called ${String(property)}`,
      );
    },
  });
}
