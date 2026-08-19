import type { ClientSession } from "mongodb";
import {
  inTransaction,
  mongoContext,
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
 */
export class MongoStore {
  constructor(private readonly target: MongoTarget) {}

  context(): Promise<MongoContext> {
    return mongoContext(this.target);
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
