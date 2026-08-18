/**
 * The test-only residue: what the repository interfaces cannot express, so the
 * integration suite never has to reach for the storage technology.
 *
 * One method, and it should stay that way — anything a production repository
 * can already do belongs there instead, which is why seeding a league lives in
 * `support/subjects.ts` and goes through `createWithFoundingTeam`.
 */
export interface TestStore {
  /**
   * Wipes per-test data. The Global League and its `system` admin player are
   * seeded by migration 0002 and must survive, so tests see the same baseline
   * as production.
   */
  reset(): Promise<void>;
}
