import { League } from "../../../../model";

export interface NewLeagueAttrs {
  id: string;
  name: string;
  adminId: string;
  domain?: string;
  icon?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * The test-only residue: what the repository interfaces cannot express, so the
 * integration suite never has to reach for the storage technology. Every method
 * here is one a second target must also implement, so the interface stays
 * deliberately small — anything a production repository can already do belongs
 * there instead.
 */
export interface TestStore {
  /**
   * Wipes per-test data. The Global League and its `system` admin player are
   * seeded by migration 0002 and must survive, so tests see the same baseline
   * as production.
   */
  reset(): Promise<void>;
  /**
   * `LeagueRepository` is read-only in production, so a second league has no
   * write path yet. Only the tests asserting cross-league isolation need one;
   * everything else uses the Global League. When league creation lands
   * (`feat/league-section-hub`), this delegates to the real repository method.
   */
  createLeague(attrs: NewLeagueAttrs): Promise<League>;
}
