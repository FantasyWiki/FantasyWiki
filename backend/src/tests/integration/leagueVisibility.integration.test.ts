import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import { GLOBAL_LEAGUE_ID } from "../../../../model";
import {
  INVITATION_CODE_ALPHABET,
  INVITATION_CODE_LENGTH,
  isInvitationCode,
} from "../../../../model/league";
import { LeagueInvitePolicy, LeagueVisibility } from "../../../../model/enums";
import { LeagueRepositoryD1 } from "../../repositories/d1/leagueRepositoryD1";
import { TeamRepositoryD1 } from "../../repositories/d1/teamRepositoryD1";
import { LEAGUE_ERRORS } from "../../repositories/leagueRepository";
import { TEAM_ERRORS } from "../../repositories/teamRepository";
import { LeagueService } from "../../services/league";
import { PlayerService } from "../../services/player";
import { TeamService } from "../../services/team";
import { insertLeague, insertTeam } from "../utils/d1TestUtils";

const PRIVATE_CODE = "ZK7QW";

async function makePlayer(name: string) {
  const result = await new PlayerService(env.db).createPlayer(
    name,
    `${name}@example.com`,
    `acct-${name}`,
  );
  if (!result.ok) throw new Error("setup failed");
  return result.value;
}

describe("migration 0007", () => {
  it("leaves the Global League public, so nobody is locked out of it", async () => {
    // Every player is auto-enrolled here on first login. If this migration
    // ever made it private, signup would break for everyone at once.
    const result = await new LeagueRepositoryD1(env.db).getById(
      GLOBAL_LEAGUE_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.visibility).toBe(LeagueVisibility.PUBLIC);
    expect(result.value.invitePolicy).toBe(LeagueInvitePolicy.MEMBERS);
  });

  it("backfills the Global League with a code the model would accept", async () => {
    // A migration takes no bind parameters, so the literal in the SQL cannot
    // reference INVITATION_CODE_ALPHABET. This is what pins the two together.
    const result = await new LeagueRepositoryD1(env.db).getInvitationCode(
      GLOBAL_LEAGUE_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toBeNull();
    expect(result.value).toHaveLength(INVITATION_CODE_LENGTH);
    expect(isInvitationCode(result.value)).toBe(true);
    for (const c of result.value!) {
      expect(INVITATION_CODE_ALPHABET).toContain(c);
    }
  });

  it("defaults a league that says nothing about visibility to public", async () => {
    // 22 test sites insert leagues without naming these columns. The defaults
    // are what keeps every one of them meaning what it did before.
    await env.db
      .prepare(
        "INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "legacy-shape",
        "Legacy",
        "system",
        "2026-01-01T00:00:00Z",
        "2026-03-01T00:00:00Z",
        "en",
        "🏁",
      )
      .run();

    const result = await new LeagueRepositoryD1(env.db).getById("legacy-shape");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.visibility).toBe(LeagueVisibility.PUBLIC);
  });

  it("lets any number of leagues carry no code, but no two carry the same one", async () => {
    // SQLite treats NULLs in a unique index as distinct. That single fact is
    // what lets the column stay nullable, which is what lets every legacy
    // INSERT above keep working.
    await insertLeague(env.db, { id: "no-code-1" });
    await insertLeague(env.db, { id: "no-code-2" });

    await insertLeague(env.db, { id: "coded-1", invitationCode: PRIVATE_CODE });
    await expect(
      insertLeague(env.db, { id: "coded-2", invitationCode: PRIVATE_CODE }),
    ).rejects.toThrow();
  });
});

describe("toLeague", () => {
  it("reads an unrecognised visibility as private, not public", async () => {
    // Fail closed. Guessing 'public' on a value we cannot read would throw a
    // league open that nobody meant to open.
    await insertLeague(env.db, { id: "corrupt" });
    await env.db
      .prepare("UPDATE leagues SET visibility = 'sideways' WHERE id = ?")
      .bind("corrupt")
      .run();

    const result = await new LeagueRepositoryD1(env.db).getById("corrupt");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.visibility).toBe(LeagueVisibility.PRIVATE);
  });
});

describe("the join gate", () => {
  let teamService: TeamService;

  beforeEach(() => {
    teamService = new TeamService(env.db);
  });

  it("lets anyone into a public league without a code", async () => {
    const player = await makePlayer("joiner");

    const result = await teamService.createTeam(
      player.id,
      GLOBAL_LEAGUE_ID,
      "Open Season",
    );

    expect(result.ok).toBe(true);
  });

  it("turns away a private league with no code", async () => {
    const player = await makePlayer("outsider");
    await insertLeague(env.db, {
      id: "private-1",
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: PRIVATE_CODE,
    });

    const result = await teamService.createTeam(
      player.id,
      "private-1",
      "Gatecrasher",
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAGUE_IS_PRIVATE });
  });

  it("turns away a private league with the wrong code", async () => {
    const player = await makePlayer("guesser");
    await insertLeague(env.db, {
      id: "private-2",
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: PRIVATE_CODE,
    });

    const result = await teamService.createTeam(
      player.id,
      "private-2",
      "Wrong Key",
      "AAAAA",
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAGUE_IS_PRIVATE });
  });

  it("lets a correct code in, however it was typed", async () => {
    const player = await makePlayer("invitee");
    await insertLeague(env.db, {
      id: "private-3",
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: PRIVATE_CODE,
    });

    const result = await teamService.createTeam(
      player.id,
      "private-3",
      "Invited XI",
      // Lowercase, spaced and hyphenated — how a code arrives out of a chat.
      " zk7-qw ",
    );

    expect(result.ok).toBe(true);
  });

  it("lets the league's own admin in without a code", async () => {
    // #4 adds the creator to the league it just created. A blanket refusal
    // would lock a player out of their own league.
    const admin = await makePlayer("founder");
    await insertLeague(env.db, {
      id: "private-4",
      adminId: admin.id,
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: PRIVATE_CODE,
    });

    const result = await teamService.createTeam(
      admin.id,
      "private-4",
      "Founders XI",
    );

    expect(result.ok).toBe(true);
  });

  it("reports a league that does not exist as missing", async () => {
    // Previously this attempted the insert and surfaced a foreign-key failure
    // as a 400.
    const player = await makePlayer("lost");

    const result = await teamService.createTeam(
      player.id,
      "no-such-league",
      "Nowhere FC",
    );

    expect(result).toEqual({ ok: false, error: LEAGUE_ERRORS.NOT_FOUND });
  });

  it("refuses at the write, not only at the pre-check", async () => {
    // Straight at the repository, bypassing the service — this is the state a
    // concurrent request creates when a league turns private between the
    // check and the insert.
    const player = await makePlayer("racer");
    await insertLeague(env.db, {
      id: "private-5",
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: PRIVATE_CODE,
    });

    const result = await new TeamRepositoryD1(env.db).create({
      name: "Race Winner",
      playerId: player.id,
      leagueId: "private-5",
    });

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.JOIN_CONFLICT });
  });

  it("does not let a code from one league open another", async () => {
    const player = await makePlayer("crosser");
    await insertLeague(env.db, {
      id: "private-a",
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: PRIVATE_CODE,
    });
    await insertLeague(env.db, {
      id: "private-b",
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: "M4RSX",
    });

    const result = await teamService.createTeam(
      player.id,
      "private-b",
      "Wrong Door",
      PRIVATE_CODE,
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAGUE_IS_PRIVATE });
  });

  it("does not treat a codeless private league as open to an empty code", async () => {
    // The SQL compares against '' when no code is offered. A private league
    // whose code is NULL must not match that.
    const player = await makePlayer("emptycode");
    await insertLeague(env.db, {
      id: "private-nocode",
      visibility: LeagueVisibility.PRIVATE,
    });

    const result = await teamService.createTeam(
      player.id,
      "private-nocode",
      "Empty Key",
      "",
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAGUE_IS_PRIVATE });
  });
});

describe("LeagueService.getInvitationCode", () => {
  let service: LeagueService;

  beforeEach(() => {
    service = new LeagueService(env.db);
  });

  it("gives a member the code when the policy is members", async () => {
    const player = await makePlayer("member");
    await insertLeague(env.db, {
      id: "inv-members",
      invitePolicy: LeagueInvitePolicy.MEMBERS,
      invitationCode: PRIVATE_CODE,
    });
    await insertTeam(env.db, {
      id: "t-member",
      name: "Member FC",
      playerId: player.id,
      leagueId: "inv-members",
    });

    const result = await service.getInvitationCode(
      player.id,
      "inv-members",
      true,
    );

    expect(result).toEqual({ ok: true, value: { code: PRIVATE_CODE } });
  });

  it("hides the code from a non-member behind the same answer as a missing league", async () => {
    // Telling a stranger a code exists tells them there is something to guess.
    const player = await makePlayer("stranger");
    await insertLeague(env.db, {
      id: "inv-closed",
      invitePolicy: LeagueInvitePolicy.MEMBERS,
      invitationCode: PRIVATE_CODE,
    });

    const result = await service.getInvitationCode(
      player.id,
      "inv-closed",
      false,
    );

    expect(result).toEqual({ ok: false, error: LEAGUE_ERRORS.NOT_FOUND });
  });

  it("gives the admin the code when the policy is admin", async () => {
    const admin = await makePlayer("theadmin");
    await insertLeague(env.db, {
      id: "inv-admin",
      adminId: admin.id,
      invitePolicy: LeagueInvitePolicy.ADMIN,
      invitationCode: PRIVATE_CODE,
    });

    const result = await service.getInvitationCode(admin.id, "inv-admin", true);

    expect(result).toEqual({ ok: true, value: { code: PRIVATE_CODE } });
  });

  it("refuses a mere member when the policy is admin", async () => {
    const admin = await makePlayer("owner");
    const member = await makePlayer("rankandfile");
    await insertLeague(env.db, {
      id: "inv-admin-only",
      adminId: admin.id,
      invitePolicy: LeagueInvitePolicy.ADMIN,
      invitationCode: PRIVATE_CODE,
    });

    const result = await service.getInvitationCode(
      member.id,
      "inv-admin-only",
      true,
    );

    expect(result).toEqual({ ok: false, error: LEAGUE_ERRORS.NOT_FOUND });
  });

  it("says so when a league has no code rather than claiming it is missing", async () => {
    const player = await makePlayer("codeless");
    await insertLeague(env.db, { id: "inv-none" });

    const result = await service.getInvitationCode(player.id, "inv-none", true);

    expect(result).toEqual({
      ok: false,
      error: LEAGUE_ERRORS.NO_INVITATION_CODE,
    });
  });
});
