import type { ClientSession, Db, MongoClient } from "mongodb";
import { ensureSchema } from "./bootstrap";

/** Where a Mongo-backed deployment keeps its data. */
export interface MongoTarget {
  /** A connection string. Its path names the database unless `database` does. */
  url: string;
  database?: string;
}

export interface MongoContext {
  client: MongoClient;
  db: Db;
}

/**
 * Open a connection, and ensure the schema behind it.
 *
 * **Not cached at module scope, and it must not be.** A Worker owns its I/O
 * objects per *request*: a socket opened while handling one request cannot be
 * touched by the next one, and the MongoDB driver's pooled connection is
 * exactly such a socket. A client cached in a module variable therefore serves
 * the request that opened it and then hangs every request after — not an error
 * the driver reports, but a promise that never settles, which workerd
 * eventually kills with "your Worker's code had hung".
 *
 * So the lifetime of a client is the lifetime of a request, and
 * {@link MongoStore} — which `repositoriesFor` builds one of per request — is
 * where it is cached. Sockets are reclaimed when the request context ends, so
 * nothing has to close them.
 *
 * The test suite cannot catch this: it runs outside any request context, where
 * the restriction does not apply. `wrangler dev` is where it shows.
 */
export async function openMongo(target: MongoTarget): Promise<MongoContext> {
  // Imported here rather than at the top of the file, so a D1 deployment — and
  // the D1 half of the test suite — never loads the driver at all. Everything
  // else this module names from `mongodb` is a type, and types are erased.
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(target.url);
  await client.connect();
  const db = client.db(target.database);
  await ensureSchema(db);
  return { client, db };
}

/**
 * Run `work` as one transaction.
 *
 * This is where the Mongo target keeps the guarantees the repository contracts
 * describe as "conditions evaluated inside the write". D1 gets them from
 * single-statement atomicity; here the statements are several, so they are
 * wrapped instead — and every such transaction also *writes* the document it
 * is guarding against (see `LeagueDoc.revision`), because snapshot isolation
 * alone would let two transactions that merely read it both commit.
 *
 * `withTransaction` retries the callback on a write conflict, so `work` must be
 * safe to run more than once — every one below re-reads what it decides on.
 */
export async function inTransaction<T>(
  context: MongoContext,
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = context.client.startSession();
  try {
    return await session.withTransaction(work, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      readPreference: "primary",
    });
  } finally {
    await session.endSession();
  }
}

/**
 * Whether a write lost a uniqueness race on the named field.
 *
 * The Mongo counterpart of `isUsernameConflict` in `playerRepositoryD1`, and
 * the same rule applies: the driver's wording never leaves this layer. Mongo
 * reports the offending index rather than SQLite's column list, so the key
 * pattern is what gets matched.
 */
export function isDuplicateKey(error: unknown, field?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ((error as { code?: unknown }).code !== 11000) return false;
  if (field === undefined) return true;
  const keyPattern = (error as { keyPattern?: Record<string, unknown> })
    .keyPattern;
  if (keyPattern && Object.hasOwn(keyPattern, field)) return true;
  return String((error as { message?: unknown }).message ?? "").includes(field);
}

/** The driver's message, or a stand-in, phrased as the D1 repositories phrase it. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
