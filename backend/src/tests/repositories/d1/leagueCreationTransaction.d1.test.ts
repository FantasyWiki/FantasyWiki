import { env } from "cloudflare:workers";
import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect } from "vitest";
import {
  LeagueInvitePolicy,
  LeagueVisibility,
} from "../../../../../model/enums";
import { LEAGUE_ICONS } from "../../../../../model/league";
import { REFERENCE_SCALE } from "../../../../../model/languageScale";
import { LeagueRepositoryD1 } from "../../../repositories/d1/leagueRepositoryD1";
import { aPlayer } from "../../support/subjects";

/**
 * A league and its founding team are one transaction, and this is the test that
 * demonstrates it.
 *
 * D1-tier because provoking the failure needs a statement D1 will refuse for a
 * reason of its own — and only the second one, since a first-statement failure
 * would prove nothing about rollback. A null team name is exactly that: it
 * passes the league write and then trips `teams.name NOT NULL`. Another target
 * would have to demonstrate its own atomicity its own way, which is why the
 * promise is written here rather than in the conformance suite.
 */
describe("createWithFoundingTeam", () => {
  it("leaves no league behind when the founding team cannot be written", async () => {
    const founderId = await aPlayer();
    const before = await env.db
      .prepare("SELECT COUNT(*) AS n FROM leagues")
      .first<{ n: number }>();

    const result = await new LeagueRepositoryD1(env.db).createWithFoundingTeam(
      {
        name: "Doomed",
        adminId: founderId,
        startDate: Temporal.Instant.from("2026-01-01T00:00:00Z"),
        endDate: Temporal.Instant.from("2026-02-01T00:00:00Z"),
        domain: "en",
        languageScale: REFERENCE_SCALE,
        visibility: LeagueVisibility.PUBLIC,
        invitePolicy: LeagueInvitePolicy.MEMBERS,
        icon: LEAGUE_ICONS[0],
        invitationCode: null,
      },
      null as unknown as string,
    );

    expect(result.ok).toBe(false);
    const after = await env.db
      .prepare("SELECT COUNT(*) AS n FROM leagues")
      .first<{ n: number }>();
    expect(after?.n).toBe(before?.n);
    // And no orphan league under the name either, in case the count above ever
    // stops being the sharp instrument it is here.
    const orphan = await env.db
      .prepare("SELECT id FROM leagues WHERE name = ?")
      .bind("Doomed")
      .first();
    expect(orphan).toBeNull();
  });
});
