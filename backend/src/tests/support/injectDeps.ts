import { createMiddleware } from "hono/factory";
import { AppVariables } from "../../appEnv";
import { repositories } from "./target";
import { unusedWikimedia } from "./wikimedia";

/**
 * What the middleware in `index.ts` does, for tests that mount a router on
 * their own app instead of driving the wired one: put the repositories on the
 * context so the handlers behind it can build their services.
 */
export function injectDeps(overrides: Partial<AppVariables> = {}) {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    c.set("repositories", overrides.repositories ?? repositories());
    c.set("wikimedia", overrides.wikimedia ?? unusedWikimedia());
    return next();
  });
}
