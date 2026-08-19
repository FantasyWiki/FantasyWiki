import {
  mongoContext,
  type MongoTarget,
} from "../../../repositories/mongo/connection";
import { seedBaseline } from "../../../repositories/mongo/bootstrap";
import { COLLECTIONS } from "../../../repositories/mongo/schema";
import { TestStore } from "../testStore";

/** The Mongo {@link TestStore}: the only Mongo the test suite still contains. */
export class MongoTestStore implements TestStore {
  constructor(private readonly target: MongoTarget) {}

  /**
   * Empties every collection and re-seeds the baseline, rather than dropping the
   * database.
   *
   * The D1 store drops the schema and replays the migrations because that is
   * where its baseline is defined. Mongo has no schema to replay — the indexes
   * and the seed are `bootstrap.ts`, which is what a production deployment runs
   * too, so this cannot drift from production's for the same reason. Dropping
   * the database would take the indexes with it, and the uniqueness they carry
   * is part of what the suite is judging.
   */
  async reset(): Promise<void> {
    const { db } = await mongoContext(this.target);
    await Promise.all(
      Object.values(COLLECTIONS).map((name) =>
        db.collection(name).deleteMany({}),
      ),
    );
    await seedBaseline(db);
  }
}
