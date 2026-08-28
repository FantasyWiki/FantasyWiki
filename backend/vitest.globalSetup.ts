import { stopMongoServer } from "./vitest.shared";

/**
 * Nothing to set up — the Mongo server has to exist before the config that
 * binds its URL is built, so it is started there. This is only the other end of
 * that: without it the `mongod` outlives the run and holds Vitest open until it
 * gives up waiting.
 */
export async function teardown(): Promise<void> {
  await stopMongoServer();
}
