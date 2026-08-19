import { env } from "cloudflare:workers";
import { describe, it, expect } from "vitest";
import { GLOBAL_LEAGUE_ID } from "../../../../../model";
import { store } from "../../support/target";

/**
 * The D1 behaviour `D1TestStore.reset()` is built on. None of it is documented
 * as stable, so it is pinned here: if an upgrade to workerd, miniflare or
 * `@cloudflare/vitest-pool-workers` changes one of these answers, this fails
 * with the reason rather than the whole suite failing with a missing table.
 */
describe("D1 reset preconditions", () => {
  it("enforces foreign keys and ignores an attempt to turn them off", async () => {
    const before = await env.db.prepare("PRAGMA foreign_keys").first();
    expect(before).toEqual({ foreign_keys: 1 });

    await env.db.prepare("PRAGMA foreign_keys = OFF").run();

    // Silently ignored — which is why the wipe cannot simply disable them.
    const after = await env.db.prepare("PRAGMA foreign_keys").first();
    expect(after).toEqual({ foreign_keys: 1 });
  });

  it("refuses to drop a table while another still references it", async () => {
    // The reason reset() retries instead of encoding a drop order: `teams`
    // references `players`, so this direction is rejected.
    await expect(env.db.prepare("DROP TABLE players").run()).rejects.toThrow();
  });

  it("allows the migrations bookkeeping table to be dropped", async () => {
    // What makes a replay possible: applyD1Migrations skips migrations already
    // recorded in `d1_migrations`, so a reset has to be able to clear it.
    await expect(
      env.db.prepare("DROP TABLE d1_migrations").run(),
    ).resolves.toBeDefined();
  });

  it("rejects writes to D1's own metadata table", async () => {
    // Why the wipe skips `_cf_METADATA` by name.
    await expect(
      env.db.prepare("DELETE FROM _cf_METADATA").run(),
    ).rejects.toThrow(/SQLITE_AUTH/);
  });
});

describe("D1TestStore.reset", () => {
  it("restores the schema after it has been dropped entirely", async () => {
    await env.db.prepare("DROP VIEW IF EXISTS team_credits").run();
    await env.db.prepare("DROP TABLE IF EXISTS notifications").run();
    await env.db.prepare("DROP TABLE IF EXISTS contracts").run();

    await store().reset();

    const objects = await env.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'",
      )
      .all<{ name: string }>();
    const names = objects.results.map((object) => object.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "google_accounts",
        "players",
        "leagues",
        "teams",
        "contracts",
        "notifications",
        "performances",
        "lineups",
        "team_credits",
      ]),
    );
  });

  it("leaves the migration baseline in place", async () => {
    await store().reset();

    const league = await env.db
      .prepare("SELECT id FROM leagues WHERE id = ?")
      .bind(GLOBAL_LEAGUE_ID)
      .first();
    const admin = await env.db
      .prepare("SELECT id FROM players WHERE id = 'system'")
      .first();

    expect(league).toEqual({ id: GLOBAL_LEAGUE_ID });
    expect(admin).toEqual({ id: "system" });
  });

  it("drops anything a test created outside the migrations", async () => {
    await env.db.prepare("CREATE TABLE scratch (id TEXT PRIMARY KEY)").run();

    await store().reset();

    const scratch = await env.db
      .prepare("SELECT name FROM sqlite_master WHERE name = 'scratch'")
      .first();
    expect(scratch).toBeNull();
  });
});
