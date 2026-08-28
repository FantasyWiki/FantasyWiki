import type { ClientSession } from "mongodb";
import {
  inTransaction,
  openMongo,
  type MongoContext,
  type MongoTarget,
} from "./connection";
import { collections, type MongoCollections } from "./schema";

/**
 * What every Mongo repository is handed: the collections, and the way to run
 * several writes as one.
 *
 * It exists so the repositories below hold a *target* rather than a live
 * connection. `repositoriesFor` is synchronous — the request pipeline, the
 * settlement Workflow and the test seam all call it that way — while connecting
 * is not, so the connection has to be reached for on the first call rather than
 * built when the repositories are.
 *
 * One store is one connection, and that is the whole point of the class: a
 * Worker owns its sockets per request, so a client may not outlive the request
 * that opened it (see {@link openMongo}). `repositoriesFor` builds a store per
 * request, so caching here — and nowhere higher — gives each request one
 * connection shared by all of its repository calls, and none inherited from
 * another request's.
 */
export class MongoStore {
  private connection?: Promise<MongoContext>;

  constructor(private readonly target: MongoTarget) {}

  context(): Promise<MongoContext> {
    // The promise, not the resolved client, so two calls racing the first
    // connect share it rather than opening two.
    this.connection ??= openMongo(this.target).catch((error) => {
      // A failed connect must not be remembered as the answer: the next call
      // gets a fresh attempt rather than this one's error for the whole
      // request.
      this.connection = undefined;
      throw error;
    });
    return this.connection;
  }

  async collections(): Promise<MongoCollections> {
    return collections((await this.context()).db);
  }

  /**
   * Run `work` as one transaction. It may be retried on a write conflict, so it
   * must re-read anything it decides on rather than close over an earlier read.
   */
  async transaction<T>(
    work: (
      session: ClientSession,
      of: MongoCollections,
      context: MongoContext,
    ) => Promise<T>,
  ): Promise<T> {
    const context = await this.context();
    return inTransaction(context, (session) =>
      work(session, collections(context.db), context),
    );
  }
}
