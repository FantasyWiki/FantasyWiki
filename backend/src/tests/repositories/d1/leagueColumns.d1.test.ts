import { env } from "cloudflare:workers";
import { describe, it, expect } from "vitest";
import { LeagueVisibility } from "../../../../../model/enums";
import { LeagueRepositoryD1 } from "../../../repositories/d1/leagueRepositoryD1";

/**
 * `toLeague` fails closed on a visibility it cannot read.
 *
 * D1-tier because the state it guards against is one no production write can
 * produce: reaching it needs SQL, so the setup names a column rather than a rule.
 * The behaviour itself is not a D1 detail — any mapper reading stored text has
 * the same decision to make, and this is the record of which way it goes.
 */
describe("toLeague", () => {
  it("reads an unrecognised visibility as private, not public", async () => {
    // Guessing 'public' on a value we cannot read would throw a league open that
    // nobody meant to open.
    await env.db
      .prepare(
        "INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "corrupt",
        "Corrupt",
        "system",
        "2026-01-01T00:00:00Z",
        "2126-01-01T00:00:00Z",
        "en",
        "🏁",
        "sideways",
      )
      .run();

    const result = await new LeagueRepositoryD1(env.db).getById("corrupt");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.visibility).toBe(LeagueVisibility.PRIVATE);
  });
});
