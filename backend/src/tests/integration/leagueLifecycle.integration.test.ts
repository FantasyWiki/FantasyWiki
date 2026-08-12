import { env } from "cloudflare:workers";
import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect } from "vitest";
import { GLOBAL_LEAGUE_ID } from "../../../../model";
import { isLeagueInactive } from "../../../../model/league";
import { LeagueVisibility } from "../../../../model/enums";
import { LeagueRepositoryD1 } from "../../repositories/d1/leagueRepositoryD1";
import { TeamRepositoryD1 } from "../../repositories/d1/teamRepositoryD1";
import { PlayerRepositoryD1 } from "../../repositories/d1/playerRepositoryD1";
import { LEAGUE_ERRORS } from "../../repositories/leagueRepository";
import { TEAM_ERRORS } from "../../repositories/teamRepository";
import { LEAGUE_CLOSURE_ERRORS, LeagueService } from "../../services/league";
import { PlayerService } from "../../services/player";
import { TeamService } from "../../services/team";
import { LeaderboardService } from "../../services/leaderboard";
import { insertContract, insertLeague, insertTeam } from "../utils/d1TestUtils";

const PAST = "2020-01-01T00:00:00Z";

async function makePlayer(name: string) {
  const result = await new PlayerService(env.db).createPlayer(
    name,
    `${name}@example.com`,
    `acct-${name}`,
  );
  if (!result.ok) throw new Error("setup failed");
  return result.value;
}

/** The raw row, so a test can see what a guarded write actually wrote. */
async function readLeagueClosedAt(id: string): Promise<string | null> {
  const row = await env.db
    .prepare("SELECT closedAt FROM leagues WHERE id = ?")
    .bind(id)
    .first<{ closedAt: string | null }>();
  return row?.closedAt ?? null;
}

async function readTeamLeftAt(teamId: string): Promise<string | null> {
  const row = await env.db
    .prepare("SELECT leftAt FROM teams WHERE id = ?")
    .bind(teamId)
    .first<{ leftAt: string | null }>();
  return row?.leftAt ?? null;
}

describe("migration 0008", () => {
  it("leaves every existing league open and every existing team present", async () => {
    // The migration adds two nullable columns and backfills nothing, which is
    // the correct outcome: no league has been closed and no player has left.
    // The Global League in particular has to come out of it playable, since it
    // is the one league first login enrolls into.
    const league = await new LeagueRepositoryD1(env.db).getById(
      GLOBAL_LEAGUE_ID,
    );

    expect(league.ok).toBe(true);
    if (!league.ok) return;
    expect(league.value.closedAt).toBeNull();
    expect(isLeagueInactive(league.value, Temporal.Now.instant())).toBe(false);
  });

  it("defaults a league inserted without the column to open", async () => {
    // Legacy INSERTs that name neither column must keep meaning what they did.
    await env.db
      .prepare(
        "INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "legacy-lifecycle",
        "Legacy",
        "system",
        "2026-01-01T00:00:00Z",
        "2126-03-01T00:00:00Z",
        "en",
        "🏁",
      )
      .run();

    const result = await new LeagueRepositoryD1(env.db).getById(
      "legacy-lifecycle",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.closedAt).toBeNull();
  });
});

// ─── The guarded close, at the repository level ───────────────────────────────
//
// These bypass `LeagueService` entirely and go straight at the statement. That
// is the point: the service's re-read exists to *explain* a refusal, and if the
// conditions lived there instead of in the SQL, a concurrent request would slip
// past them and no service-level test would ever notice
// (docs/architecture/backend-error-constants.md §2).

describe("LeagueRepositoryD1.close guarded UPDATE", () => {
  it("stamps closedAt for the league's own admin", async () => {
    const admin = await makePlayer("closer");
    await insertLeague(env.db, { id: "lg-close", adminId: admin.id });
    const at = Temporal.Instant.from("2026-08-12T10:00:00Z");

    const result = await new LeagueRepositoryD1(env.db).close(
      "lg-close",
      admin.id,
      at,
    );

    expect(result.ok).toBe(true);
    expect(await readLeagueClosedAt("lg-close")).toBe(at.toString());
  });

  it("refuses a caller who is not the league's admin, and writes nothing", async () => {
    // The authorization rule is a condition of the write, not a check before
    // it. A stranger reaching the repository directly — which is exactly the
    // shape of a concurrent request that arrived while the admin check was
    // being made elsewhere — still cannot close the league.
    const admin = await makePlayer("owner");
    const stranger = await makePlayer("stranger");
    await insertLeague(env.db, { id: "lg-guard", adminId: admin.id });

    const result = await new LeagueRepositoryD1(env.db).close(
      "lg-guard",
      stranger.id,
      Temporal.Now.instant(),
    );

    expect(result).toEqual({
      ok: false,
      error: LEAGUE_ERRORS.CLOSE_CONFLICT,
    });
    expect(await readLeagueClosedAt("lg-guard")).toBeNull();
  });

  it("refuses a second close and keeps the first moment", async () => {
    // The whole reason `closedAt IS NULL` is in the statement: two closes
    // racing would both find the column empty, and the later write would move
    // the recorded end of the season. The first stamp is the true one.
    const admin = await makePlayer("twice");
    await insertLeague(env.db, { id: "lg-twice", adminId: admin.id });
    const repository = new LeagueRepositoryD1(env.db);
    const first = Temporal.Instant.from("2026-08-01T00:00:00Z");
    const second = Temporal.Instant.from("2026-08-02T00:00:00Z");

    expect((await repository.close("lg-twice", admin.id, first)).ok).toBe(true);
    const result = await repository.close("lg-twice", admin.id, second);

    expect(result).toEqual({
      ok: false,
      error: LEAGUE_ERRORS.CLOSE_CONFLICT,
    });
    expect(await readLeagueClosedAt("lg-twice")).toBe(first.toString());
  });

  it("refuses a league that is not there", async () => {
    const result = await new LeagueRepositoryD1(env.db).close(
      "no-such-league",
      "whoever",
      Temporal.Now.instant(),
    );

    expect(result).toEqual({
      ok: false,
      error: LEAGUE_ERRORS.CLOSE_CONFLICT,
    });
  });
});

// ─── The join gate, at the repository level ───────────────────────────────────

describe("TeamRepositoryD1.create guarded INSERT — lifecycle conditions", () => {
  it("refuses a closed league", async () => {
    const player = await makePlayer("latecomer");
    await insertLeague(env.db, { id: "lg-shut", closedAt: PAST });

    const result = await new TeamRepositoryD1(env.db).create({
      name: "Too Late FC",
      playerId: player.id,
      leagueId: "lg-shut",
    });

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.JOIN_CONFLICT });
  });

  it("refuses a player who already fields a team here", async () => {
    // `UNIQUE (playerId, leagueId)` would also stop this, but as driver text
    // the layer above would have to pattern-match. As a condition of the write
    // it comes back through the sentinel protocol like every other refusal.
    const player = await makePlayer("doubler");
    await insertLeague(env.db, { id: "lg-dup" });
    await insertTeam(env.db, {
      id: "team-dup",
      name: "First",
      playerId: player.id,
      leagueId: "lg-dup",
    });

    const result = await new TeamRepositoryD1(env.db).create({
      name: "Second",
      playerId: player.id,
      leagueId: "lg-dup",
    });

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.JOIN_CONFLICT });
  });

  it("refuses a player who left, so leaving is final", async () => {
    // This is what makes a departure a record rather than a toggle: the row
    // they left is the only one they will ever have here, so the gate has to
    // see it even though every "current member" read cannot.
    const player = await makePlayer("returner");
    await insertLeague(env.db, { id: "lg-back" });
    await insertTeam(env.db, {
      id: "team-back",
      name: "Gone",
      playerId: player.id,
      leagueId: "lg-back",
    });
    await env.db
      .prepare("UPDATE teams SET leftAt = ? WHERE id = ?")
      .bind(PAST, "team-back")
      .run();

    const result = await new TeamRepositoryD1(env.db).create({
      name: "Comeback FC",
      playerId: player.id,
      leagueId: "lg-back",
    });

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.JOIN_CONFLICT });
  });

  it("still admits a newcomer to an open league", async () => {
    // The guard has to refuse the four cases above without refusing the
    // ordinary one.
    const player = await makePlayer("newcomer");
    await insertLeague(env.db, { id: "lg-open" });

    const result = await new TeamRepositoryD1(env.db).create({
      name: "Fresh XI",
      playerId: player.id,
      leagueId: "lg-open",
    });

    expect(result.ok).toBe(true);
  });
});

// ─── The guarded leave, at the repository level ───────────────────────────────

describe("TeamRepositoryD1.leave guarded UPDATE", () => {
  async function seedMember(
    suffix: string,
    leagueOpts: { closedAt?: string } = {},
  ) {
    const admin = await makePlayer(`admin-${suffix}`);
    const member = await makePlayer(`member-${suffix}`);
    const leagueId = `lg-${suffix}`;
    await insertLeague(env.db, {
      id: leagueId,
      adminId: admin.id,
      ...leagueOpts,
    });
    await insertTeam(env.db, {
      id: `team-${suffix}`,
      name: `Team ${suffix}`,
      playerId: member.id,
      leagueId,
    });
    return { admin, member, leagueId, teamId: `team-${suffix}` };
  }

  it("stamps leftAt on the departing player's team", async () => {
    const { member, leagueId, teamId } = await seedMember("leave");
    const at = Temporal.Instant.from("2026-08-12T12:00:00Z");

    const result = await new TeamRepositoryD1(env.db).leave(
      member.id,
      leagueId,
      at,
    );

    expect(result.ok).toBe(true);
    expect(await readTeamLeftAt(teamId)).toBe(at.toString());
  });

  it("refuses a second departure and keeps the first moment", async () => {
    const { member, leagueId, teamId } = await seedMember("twice-leave");
    const repository = new TeamRepositoryD1(env.db);
    const first = Temporal.Instant.from("2026-08-01T00:00:00Z");

    expect((await repository.leave(member.id, leagueId, first)).ok).toBe(true);
    const result = await repository.leave(
      member.id,
      leagueId,
      Temporal.Instant.from("2026-08-05T00:00:00Z"),
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAVE_CONFLICT });
    expect(await readTeamLeftAt(teamId)).toBe(first.toString());
  });

  it("refuses the league's own admin", async () => {
    // Only the admin can close a league. An admin who walked away would leave
    // one nobody could ever end.
    const { admin, leagueId } = await seedMember("adminleave");
    await insertTeam(env.db, {
      id: "team-adminleave-own",
      name: "Founder XI",
      playerId: admin.id,
      leagueId,
    });

    const result = await new TeamRepositoryD1(env.db).leave(
      admin.id,
      leagueId,
      Temporal.Now.instant(),
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAVE_CONFLICT });
    expect(await readTeamLeftAt("team-adminleave-own")).toBeNull();
  });

  it("refuses the Global League", async () => {
    // Leaving it would strand the player: first run routes anyone without a
    // Global League team to create one, and the join gate would then refuse.
    const player = await makePlayer("globalleaver");
    await insertTeam(env.db, {
      id: "team-global",
      name: "Worldwide",
      playerId: player.id,
      leagueId: GLOBAL_LEAGUE_ID,
    });

    const result = await new TeamRepositoryD1(env.db).leave(
      player.id,
      GLOBAL_LEAGUE_ID,
      Temporal.Now.instant(),
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAVE_CONFLICT });
    expect(await readTeamLeftAt("team-global")).toBeNull();
  });

  it("refuses a league closed in the meantime", async () => {
    // The race the statement exists for: the admin's close landed between this
    // player's pre-check and their write.
    const { member, leagueId, teamId } = await seedMember("shutleave", {
      closedAt: PAST,
    });

    const result = await new TeamRepositoryD1(env.db).leave(
      member.id,
      leagueId,
      Temporal.Now.instant(),
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAVE_CONFLICT });
    expect(await readTeamLeftAt(teamId)).toBeNull();
  });

  it("refuses a player who has no team in the league", async () => {
    const outsider = await makePlayer("outsider");
    await insertLeague(env.db, { id: "lg-outside" });

    const result = await new TeamRepositoryD1(env.db).leave(
      outsider.id,
      "lg-outside",
      Temporal.Now.instant(),
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAVE_CONFLICT });
  });
});

// ─── Service-level classification ────────────────────────────────────────────
//
// One sentinel comes back from each guarded write; these pin that the re-read
// turns it into the right named error, which is the half a caller sees.

describe("LeagueService.closeLeague", () => {
  it("closes the league and answers with the DTO the page can replace", async () => {
    const admin = await makePlayer("svc-admin");
    await insertLeague(env.db, { id: "svc-close", adminId: admin.id });
    await insertTeam(env.db, {
      id: "svc-close-team",
      name: "Founders",
      playerId: admin.id,
      leagueId: "svc-close",
    });

    const result = await new LeagueService(env.db).closeLeague(
      admin.id,
      "svc-close",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.closedAt).not.toBeNull();
    expect(result.value.teamCount).toBe(1);
    expect(isLeagueInactive(result.value, Temporal.Now.instant())).toBe(true);
  });

  it("tells a non-admin they are not the admin, rather than that the league is missing", async () => {
    // 403, not the invite-code endpoint's 404: a league's page and standings are
    // readable by anyone holding its id, so there is nothing here to conceal.
    const admin = await makePlayer("svc-owner");
    const member = await makePlayer("svc-member");
    await insertLeague(env.db, { id: "svc-notadmin", adminId: admin.id });

    const result = await new LeagueService(env.db).closeLeague(
      member.id,
      "svc-notadmin",
    );

    expect(result).toEqual({
      ok: false,
      error: LEAGUE_CLOSURE_ERRORS.NOT_ADMIN,
    });
  });

  it("names a repeat close rather than reporting one that did not happen", async () => {
    const admin = await makePlayer("svc-twice");
    await insertLeague(env.db, { id: "svc-twice-lg", adminId: admin.id });
    const service = new LeagueService(env.db);

    expect((await service.closeLeague(admin.id, "svc-twice-lg")).ok).toBe(true);
    const result = await service.closeLeague(admin.id, "svc-twice-lg");

    expect(result).toEqual({
      ok: false,
      error: LEAGUE_CLOSURE_ERRORS.ALREADY_CLOSED,
    });
  });

  it("reports a league that is not there as not found", async () => {
    const result = await new LeagueService(env.db).closeLeague(
      "whoever",
      "no-such-league",
    );

    expect(result).toEqual({ ok: false, error: LEAGUE_ERRORS.NOT_FOUND });
  });
});

describe("TeamService.createTeam — lifecycle refusals", () => {
  it("refuses a closed league by name", async () => {
    const player = await makePlayer("join-shut");
    await insertLeague(env.db, { id: "join-shut-lg", closedAt: PAST });

    const result = await new TeamService(env.db).createTeam(
      player.id,
      "join-shut-lg",
      "Too Late FC",
    );

    expect(result).toEqual({
      ok: false,
      error: TEAM_ERRORS.LEAGUE_INACTIVE,
    });
  });

  it("refuses a league whose season has simply run out", async () => {
    // The half of inactivity the SQL deliberately does not carry: `endDate`
    // cannot change, so checking it before the write is not a race, and the
    // rule stays stated once in `isLeagueInactive`.
    const player = await makePlayer("join-ended");
    await insertLeague(env.db, {
      id: "join-ended-lg",
      startDate: "2024-01-01T00:00:00Z",
      endDate: "2024-02-01T00:00:00Z",
    });

    const result = await new TeamService(env.db).createTeam(
      player.id,
      "join-ended-lg",
      "Season Over FC",
    );

    expect(result).toEqual({
      ok: false,
      error: TEAM_ERRORS.LEAGUE_INACTIVE,
    });
  });

  // Rejoining is the same row with `leftAt` cleared, never a second team —
  // `UNIQUE (playerId, leagueId)` would refuse one, and there is nothing to
  // restore because leaving removed nothing.
  async function seedDeparted(suffix: string, teamName = "Gone XI") {
    const admin = await makePlayer(`rejoin-admin-${suffix}`);
    const player = await makePlayer(`rejoiner-${suffix}`);
    const leagueId = `rejoin-lg-${suffix}`;
    await insertLeague(env.db, { id: leagueId, adminId: admin.id });
    await insertTeam(env.db, {
      id: `rejoin-team-${suffix}`,
      name: teamName,
      playerId: player.id,
      leagueId,
    });
    const service = new TeamService(env.db);
    expect((await service.leaveLeague(player.id, leagueId)).ok).toBe(true);
    return { service, player, leagueId, teamId: `rejoin-team-${suffix}` };
  }

  it("puts a departed player back into the team they left", async () => {
    const { service, player, leagueId, teamId } = await seedDeparted("back");

    const result = await service.createTeam(player.id, leagueId, "Comeback FC");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The same row, renamed — not a second team beside the abandoned one.
    expect(result.value.id).toBe(teamId);
    expect(result.value.name).toBe("Comeback FC");

    const rows = await env.db
      .prepare(
        "SELECT id, leftAt FROM teams WHERE playerId = ? AND leagueId = ?",
      )
      .bind(player.id, leagueId)
      .all<{ id: string; leftAt: string | null }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0].leftAt).toBeNull();
  });

  it("lets them keep the name they left under", async () => {
    // Their own departed row is still in the table; without excluding it, the
    // name check would find the returning player colliding with themselves.
    const { service, player, leagueId } = await seedDeparted("samename");

    const result = await service.createTeam(player.id, leagueId, "Gone XI");

    expect(result.ok).toBe(true);
  });

  it("still refuses a name another team in the league holds", async () => {
    const { service, player, leagueId } = await seedDeparted("clash");
    const rival = await makePlayer("rejoin-rival");
    await insertTeam(env.db, {
      id: "rejoin-rival-team",
      name: "Taken United",
      playerId: rival.id,
      leagueId,
    });

    const result = await service.createTeam(
      player.id,
      leagueId,
      "taken united",
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.NAME_TAKEN });
  });

  it("re-checks the league's entry rules on the way back in", async () => {
    // Left a public league that has since gone private: coming back needs the
    // code, exactly as a first join would.
    const { service, player, leagueId } = await seedDeparted("gated");
    await env.db
      .prepare(
        "UPDATE leagues SET visibility = ?, invitationCode = ? WHERE id = ?",
      )
      .bind(LeagueVisibility.PRIVATE, "ZK7QW", leagueId)
      .run();

    const refused = await service.createTeam(
      player.id,
      leagueId,
      "Comeback FC",
    );
    expect(refused).toEqual({
      ok: false,
      error: TEAM_ERRORS.LEAGUE_IS_PRIVATE,
    });

    const allowed = await service.createTeam(
      player.id,
      leagueId,
      "Comeback FC",
      "zk7qw",
    );
    expect(allowed.ok).toBe(true);
  });

  it("refuses a second team to a player who never left", async () => {
    const admin = await makePlayer("still-in-admin");
    const player = await makePlayer("still-in");
    await insertLeague(env.db, { id: "still-in-lg", adminId: admin.id });
    await insertTeam(env.db, {
      id: "still-in-team",
      name: "Present XI",
      playerId: player.id,
      leagueId: "still-in-lg",
    });

    const result = await new TeamService(env.db).createTeam(
      player.id,
      "still-in-lg",
      "Second XI",
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.ALREADY_HAS_TEAM });
  });
});

describe("TeamService.leaveLeague", () => {
  async function seed(suffix: string) {
    const admin = await makePlayer(`la-${suffix}`);
    const member = await makePlayer(`lm-${suffix}`);
    const leagueId = `ll-${suffix}`;
    await insertLeague(env.db, { id: leagueId, adminId: admin.id });
    await insertTeam(env.db, {
      id: `lt-${suffix}`,
      name: `Leavers ${suffix}`,
      playerId: member.id,
      leagueId,
    });
    return { admin, member, leagueId, teamId: `lt-${suffix}` };
  }

  it("lets a member walk away", async () => {
    const { member, leagueId, teamId } = await seed("ok");

    const result = await new TeamService(env.db).leaveLeague(
      member.id,
      leagueId,
    );

    expect(result.ok).toBe(true);
    expect(await readTeamLeftAt(teamId)).not.toBeNull();
  });

  it("names a repeat departure", async () => {
    const { member, leagueId } = await seed("again");
    const service = new TeamService(env.db);
    expect((await service.leaveLeague(member.id, leagueId)).ok).toBe(true);

    const result = await service.leaveLeague(member.id, leagueId);

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.ALREADY_LEFT });
  });

  it("tells the admin to close the league instead", async () => {
    const { admin, leagueId } = await seed("adminsvc");
    await insertTeam(env.db, {
      id: "lt-adminsvc-own",
      name: "Founder XI",
      playerId: admin.id,
      leagueId,
    });

    const result = await new TeamService(env.db).leaveLeague(
      admin.id,
      leagueId,
    );

    expect(result).toEqual({
      ok: false,
      error: TEAM_ERRORS.ADMIN_CANNOT_LEAVE,
    });
  });

  it("refuses the Global League by name", async () => {
    const player = await makePlayer("svc-globalleaver");
    await insertTeam(env.db, {
      id: "lt-global",
      name: "Worldwide",
      playerId: player.id,
      leagueId: GLOBAL_LEAGUE_ID,
    });

    const result = await new TeamService(env.db).leaveLeague(
      player.id,
      GLOBAL_LEAGUE_ID,
    );

    expect(result).toEqual({
      ok: false,
      error: TEAM_ERRORS.CANNOT_LEAVE_GLOBAL,
    });
  });

  it("answers a non-member with no team rather than a bare conflict", async () => {
    const outsider = await makePlayer("svc-outsider");
    await insertLeague(env.db, { id: "ll-outside" });

    const result = await new TeamService(env.db).leaveLeague(
      outsider.id,
      "ll-outside",
    );

    expect(result).toEqual({
      ok: false,
      error: TEAM_ERRORS.NO_TEAM_IN_LEAGUE,
    });
  });

  it("refuses a closed league — there is nothing left to walk out of", async () => {
    const { member, leagueId } = await seed("shutsvc");
    await env.db
      .prepare("UPDATE leagues SET closedAt = ? WHERE id = ?")
      .bind(PAST, leagueId)
      .run();

    const result = await new TeamService(env.db).leaveLeague(
      member.id,
      leagueId,
    );

    expect(result).toEqual({
      ok: false,
      error: TEAM_ERRORS.LEAGUE_INACTIVE,
    });
  });

  it("refuses a finished season, so no departure is recorded against one", async () => {
    // A player who merely outlived a league did not abandon it. Stamping
    // `leftAt` on a finished season would put that on the record.
    const player = await makePlayer("svc-outlived");
    await insertLeague(env.db, {
      id: "ll-ended",
      startDate: "2024-01-01T00:00:00Z",
      endDate: "2024-02-01T00:00:00Z",
    });
    await insertTeam(env.db, {
      id: "lt-ended",
      name: "Old Guard",
      playerId: player.id,
      leagueId: "ll-ended",
    });

    const result = await new TeamService(env.db).leaveLeague(
      player.id,
      "ll-ended",
    );

    expect(result).toEqual({
      ok: false,
      error: TEAM_ERRORS.LEAGUE_INACTIVE,
    });
    expect(await readTeamLeftAt("lt-ended")).toBeNull();
  });
});

// ─── What leaving means to the rest of the system ─────────────────────────────

describe("a departed player's league", () => {
  async function seedDeparture() {
    const admin = await makePlayer("dep-admin");
    const member = await makePlayer("dep-member");
    await insertLeague(env.db, { id: "dep-lg", adminId: admin.id });
    await insertTeam(env.db, {
      id: "dep-admin-team",
      name: "Founders",
      playerId: admin.id,
      leagueId: "dep-lg",
    });
    await insertTeam(env.db, {
      id: "dep-team",
      name: "Departed XI",
      playerId: member.id,
      leagueId: "dep-lg",
    });
    await insertContract(env.db, {
      id: "dep-contract",
      teamId: "dep-team",
      articleId: "Some_Article",
      purchaseDate: "2026-01-01",
      expireDate: "2126-01-08",
    });
    const left = await new TeamService(env.db).leaveLeague(member.id, "dep-lg");
    expect(left.ok).toBe(true);
    return { admin, member };
  }

  it("stops answering getMyTeam, which is what closes every scoped surface", async () => {
    // Contracts, lineup, market and the invite-code membership check all reach
    // the league through this one read, so none of them needs to know that
    // leaving exists.
    const { member } = await seedDeparture();

    const result = await new TeamService(env.db).getMyTeam(
      member.id,
      "dep-lg",
      "dep-member",
    );

    expect(result).toEqual({ ok: true, value: null });
  });

  it("keeps the team row and its whole ledger", async () => {
    // The point of the design: no contract, performance or standing is lost, so
    // the season stays exactly as auditable as it was while it was being played.
    await seedDeparture();

    const team = await env.db
      .prepare("SELECT name, leftAt FROM teams WHERE id = ?")
      .bind("dep-team")
      .first<{ name: string; leftAt: string | null }>();
    const contracts = await env.db
      .prepare("SELECT COUNT(*) AS n FROM contracts WHERE teamId = ?")
      .bind("dep-team")
      .first<{ n: number }>();

    expect(team?.name).toBe("Departed XI");
    expect(team?.leftAt).not.toBeNull();
    expect(contracts?.n).toBe(1);
  });

  it("drops out of the leagues they play", async () => {
    const { member } = await seedDeparture();

    const result = await new PlayerRepositoryD1(env.db).getLeaguesByPlayerId(
      member.id,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((l) => l.id)).not.toContain("dep-lg");
  });

  it("stops counting towards the league's size", async () => {
    // "How many teams play this league" is a question about now. Only the
    // admin's team is still playing.
    await seedDeparture();

    const result = await new LeagueRepositoryD1(env.db).countTeamsByLeague([
      "dep-lg",
    ]);

    expect(result).toEqual({ ok: true, value: { "dep-lg": 1 } });
  });

  it("keeps its place in the standings", async () => {
    // Erasing them would rewrite the league's history for everyone else too —
    // the ranks above and below them are only true with them in it.
    await seedDeparture();

    const result = await new LeaderboardService(env.db).getLeaderboard(
      "dep-lg",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((e) => e.team.name)).toContain("Departed XI");
  });
});
