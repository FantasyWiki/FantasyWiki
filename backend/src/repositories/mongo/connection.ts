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
 * One client per target per isolate, and the schema ensured once behind it.
 *
 * A `MongoClient` owns a connection pool, so building one per request — which
 * is what a per-request `repositoriesFor` would do — would open a pool per
 * request and close none of them. Caching the *promise* rather than the client
 * is what makes two concurrent first requests share one connect instead of
 * racing to open two.
 */
const contexts = new Map<string, Promise<MongoContext>>();

export function mongoContext(target: MongoTarget): Promise<MongoContext> {
  const key = `${target.url} ${target.database ?? ""}`;
  let context = contexts.get(key);
  if (!context) {
    context = open(target).catch((error) => {
      // A failed connect must not be remembered as the answer: the next caller
      // gets a fresh attempt rather than this one's error forever.
      contexts.delete(key);
      throw error;
    });
    contexts.set(key, context);
  }
  return context;
}

async function open(target: MongoTarget): Promise<MongoContext> {
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
