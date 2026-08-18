import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import { GLOBAL_LEAGUE_ID } from "../../../../model";
import { LeagueInvitePolicy, LeagueVisibility } from "../../../../model/enums";
import { isLeagueInactive, LEAGUE_ICONS } from "../../../../model/league";
import { REFERENCE_SCALE } from "../../../../model/languageScale";
import { LEAGUE_ERRORS } from "../../repositories/leagueRepository";
import { TEAM_ERRORS } from "../../repositories/teamRepository";
import { unwrap } from "../../repositories/result";
import { LeagueService } from "../../services/league";
import { PlayerService } from "../../services/player";
import { TeamService } from "../../services/team";
import { aLeague, aPlayer, unique } from "../support/subjects";
import { repositories } from "../support/target";
import type { League } from "../../../../model";

const PRIVATE_CODE = "ZK7QW";

async function makePlayer(name: string) {
  const result = await new PlayerService(repositories()).createPlayer(
    name,
    `${name}@example.com`,
    `acct-${name}`,
  );
  if (!result.ok) throw new Error("setup failed");
  return result.value;
}

/**
 * A league in the terms the gate is about: who may see it, who may hand out its
 * code, and what that code is. All four named at the call site, because the
 * gate's answer turns on every one of them.
 */
async function seedLeague(attrs: {
  visibility: LeagueVisibility;
  invitePolicy: LeagueInvitePolicy;
  invitationCode: string | null;
  adminId: string;
}): Promise<League> {
  return (
    await aLeague(
      {
        name: unique("Gated League"),
        adminId: attrs.adminId,
        startDate: Temporal.Instant.from("2026-01-01T00:00:00Z"),
        endDate: Temporal.Instant.from("2126-01-01T00:00:00Z"),
        domain: "en",
        languageScale: REFERENCE_SCALE,
        icon: LEAGUE_ICONS[0],
        visibility: attrs.visibility,
        invitePolicy: attrs.invitePolicy,
        invitationCode: attrs.invitationCode,
      },
      unique("Founders"),
    )
  ).league;
}

/** A private league behind `PRIVATE_CODE`, which most of the gate's tests need. */
async function seedPrivate(adminId: string): Promise<League> {
  return seedLeague({
    visibility: LeagueVisibility.PRIVATE,
    invitePolicy: LeagueInvitePolicy.MEMBERS,
    invitationCode: PRIVATE_CODE,
    adminId,
  });
}

describe("the seeded Global League", () => {
  it("is public, so nobody is locked out of it", async () => {
    // Every player is auto-enrolled here on first login. If it were ever seeded
    // private, signup would break for everyone at once.
    const result = await repositories().leagues.getById(GLOBAL_LEAGUE_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.visibility).toBe(LeagueVisibility.PUBLIC);
    expect(result.value.invitePolicy).toBe(LeagueInvitePolicy.MEMBERS);
  });

  it("is open, and stays the one league first login can enrol into", async () => {
    const result = await repositories().leagues.getById(GLOBAL_LEAGUE_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.closedAt).toBeNull();
    expect(isLeagueInactive(result.value, Temporal.Now.instant())).toBe(false);
  });

  it("has no invitation code, because it is public", async () => {
    // A code guards entry to a private league. The Global League is joinable
    // by anyone, so a code on it would guard nothing and would be one more
    // thing to keep true.
    const result =
      await repositories().leagues.getInvitationCode(GLOBAL_LEAGUE_ID);

    expect(result).toEqual({ ok: true, value: null });
  });
});

describe("the join gate", () => {
  let teamService: TeamService;

  beforeEach(() => {
    teamService = new TeamService(repositories());
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
    const league = await seedPrivate(await aPlayer());

    const result = await teamService.createTeam(
      player.id,
      league.id,
      "Gatecrasher",
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAGUE_IS_PRIVATE });
  });

  it("turns away a private league with the wrong code", async () => {
    const player = await makePlayer("guesser");
    const league = await seedPrivate(await aPlayer());

    const result = await teamService.createTeam(
      player.id,
      league.id,
      "Wrong Key",
      "AAAAA",
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAGUE_IS_PRIVATE });
  });

  it("lets a correct code in, however it was typed", async () => {
    const player = await makePlayer("invitee");
    const league = await seedPrivate(await aPlayer());

    const result = await teamService.createTeam(
      player.id,
      league.id,
      "Invited XI",
      // Lowercase, spaced and hyphenated — how a code arrives out of a chat.
      " zk7-qw ",
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
    const league = await seedPrivate(await aPlayer());

    const result = await repositories().teams.create({
      name: "Race Winner",
      playerId: player.id,
      leagueId: league.id,
    });

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.JOIN_CONFLICT });
  });

  it("does not let a code from one league open another", async () => {
    const player = await makePlayer("crosser");
    await seedPrivate(await aPlayer());
    const other = await seedLeague({
      visibility: LeagueVisibility.PRIVATE,
      invitePolicy: LeagueInvitePolicy.MEMBERS,
      invitationCode: "M4RSX",
      adminId: await aPlayer(),
    });

    const result = await teamService.createTeam(
      player.id,
      other.id,
      "Wrong Door",
      PRIVATE_CODE,
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAGUE_IS_PRIVATE });
  });

  it("does not treat a codeless private league as open to an empty code", async () => {
    // The SQL compares against '' when no code is offered. A private league
    // whose code is NULL must not match that.
    const player = await makePlayer("emptycode");
    const league = await seedLeague({
      visibility: LeagueVisibility.PRIVATE,
      invitePolicy: LeagueInvitePolicy.MEMBERS,
      invitationCode: null,
      adminId: await aPlayer(),
    });

    const result = await teamService.createTeam(
      player.id,
      league.id,
      "Empty Key",
      "",
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAGUE_IS_PRIVATE });
  });
});

describe("LeagueService.getInvitationCode", () => {
  let service: LeagueService;

  beforeEach(() => {
    service = new LeagueService(repositories());
  });

  it("gives a member the code when the policy is members", async () => {
    const player = await makePlayer("member");
    const league = await seedPrivate(await aPlayer());
    // Through the gate with the code, because the write refuses a bare join to a
    // private league — which is the rule the join gate above pins.
    unwrap(
      await new TeamService(repositories()).createTeam(
        player.id,
        league.id,
        "Member FC",
        PRIVATE_CODE,
      ),
      "team",
    );

    const result = await service.getInvitationCode(player.id, league.id, true);

    expect(result).toEqual({ ok: true, value: { code: PRIVATE_CODE } });
  });

  it("hides the code from a non-member behind the same answer as a missing league", async () => {
    // Telling a stranger a code exists tells them there is something to guess.
    const player = await makePlayer("stranger");
    const league = await seedPrivate(await aPlayer());

    const result = await service.getInvitationCode(player.id, league.id, false);

    expect(result).toEqual({ ok: false, error: LEAGUE_ERRORS.NOT_FOUND });
  });

  it("gives the admin the code when the policy is admin", async () => {
    const admin = await makePlayer("theadmin");
    const league = await seedLeague({
      visibility: LeagueVisibility.PRIVATE,
      invitePolicy: LeagueInvitePolicy.ADMIN,
      invitationCode: PRIVATE_CODE,
      adminId: admin.id,
    });

    const result = await service.getInvitationCode(admin.id, league.id, true);

    expect(result).toEqual({ ok: true, value: { code: PRIVATE_CODE } });
  });

  it("refuses a mere member when the policy is admin", async () => {
    const admin = await makePlayer("owner");
    const member = await makePlayer("rankandfile");
    const league = await seedLeague({
      visibility: LeagueVisibility.PRIVATE,
      invitePolicy: LeagueInvitePolicy.ADMIN,
      invitationCode: PRIVATE_CODE,
      adminId: admin.id,
    });

    const result = await service.getInvitationCode(member.id, league.id, true);

    expect(result).toEqual({ ok: false, error: LEAGUE_ERRORS.NOT_FOUND });
  });

  it("says a public league simply has no code to hand out", async () => {
    const player = await makePlayer("codeless");
    const league = await seedLeague({
      visibility: LeagueVisibility.PUBLIC,
      invitePolicy: LeagueInvitePolicy.MEMBERS,
      invitationCode: null,
      adminId: await aPlayer(),
    });

    const result = await service.getInvitationCode(player.id, league.id, true);

    expect(result).toEqual({
      ok: false,
      error: LEAGUE_ERRORS.NO_INVITATION_CODE,
    });
  });
});
