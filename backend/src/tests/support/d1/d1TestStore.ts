import { Temporal } from "@js-temporal/polyfill";
import { applyD1Migrations, D1Migration } from "cloudflare:test";
import { League } from "../../../../../model";
import {
  LeagueInvitePolicy,
  LeagueVisibility,
} from "../../../../../model/enums";
import { REFERENCE_SCALE } from "../../../../../model/languageScale";
import { NewLeagueAttrs, TestStore } from "../testStore";

/**
 * D1's own bookkeeping. Unlike `d1_migrations`, this one rejects writes with
 * SQLITE_AUTH, so a wipe has to leave it alone.
 */
const D1_INTERNAL = "_cf_METADATA";

interface SchemaObject {
  name: string;
  type: string;
}

/** The D1 {@link TestStore}: the only SQL the test suite still contains. */
export class D1TestStore implements TestStore {
  constructor(
    private db: D1Database,
    private migrations: D1Migration[],
  ) {}

  /**
   * Drops the schema and replays the migrations, rather than deleting from a
   * hand-maintained list of tables. Two reasons: a migration that adds a table
   * needs no change here, and the baseline every test starts from is the
   * migrations' own — including the Global League seeded by
   * 0002_seed_global_league — so it cannot drift from production's.
   */
  async reset(): Promise<void> {
    await this.dropSchema();
    await applyD1Migrations(this.db, this.migrations);
  }

  async createLeague(attrs: NewLeagueAttrs): Promise<League> {
    const league = {
      id: attrs.id,
      name: attrs.name,
      adminId: attrs.adminId,
      startDate: attrs.startDate ?? "2024-01-01T00:00:00Z",
      endDate: attrs.endDate ?? "2124-01-01T00:00:00Z",
      domain: attrs.domain ?? "en",
      languageScale: REFERENCE_SCALE,
      icon: attrs.icon ?? "🌍",
      visibility: LeagueVisibility.PUBLIC,
      invitePolicy: LeagueInvitePolicy.MEMBERS,
    };

    await this.db
      .prepare(
        `INSERT INTO leagues
           (id, name, adminId, startDate, endDate, domain, languageScale, icon, visibility, invitePolicy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(...Object.values(league))
      .run();

    return {
      ...league,
      startDate: Temporal.Instant.from(league.startDate),
      endDate: Temporal.Instant.from(league.endDate),
      closedAt: null,
    };
  }

  /**
   * D1 enforces foreign keys and ignores `PRAGMA foreign_keys = OFF`, so a drop
   * only succeeds once a table's children are gone. Rather than encode the
   * dependency order, retry while any drop still succeeds — the current schema
   * settles in two passes.
   */
  private async dropSchema(): Promise<void> {
    let remaining = await this.schemaObjects();
    while (remaining.length > 0) {
      let dropped = 0;
      for (const object of remaining) {
        const kind = object.type === "view" ? "VIEW" : "TABLE";
        try {
          await this.db
            .prepare(`DROP ${kind} IF EXISTS "${object.name}"`)
            .run();
          dropped++;
        } catch {
          // Still has children; a later pass gets it.
        }
      }
      if (dropped === 0) {
        const names = remaining.map((object) => object.name).join(", ");
        throw new Error(`Could not drop test schema — stuck on: ${names}`);
      }
      remaining = await this.schemaObjects();
    }
  }

  private async schemaObjects(): Promise<SchemaObject[]> {
    const result = await this.db
      .prepare(
        `SELECT name, type FROM sqlite_master
         WHERE type IN ('table', 'view')
           AND name NOT LIKE 'sqlite_%'
           AND name != ?`,
      )
      .bind(D1_INTERNAL)
      .all<SchemaObject>();
    return result.results;
  }
}
