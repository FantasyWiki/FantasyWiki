import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect } from "vitest";
import { GLOBAL_LEAGUE_ID } from "../../../../model";
import { isLeagueInactive, LEAGUE_ICONS } from "../../../../model/league";
import { LeagueInvitePolicy, LeagueVisibility } from "../../../../model/enums";
import { REFERENCE_SCALE } from "../../../../model/languageScale";
import { LEAGUE_ERRORS } from "../../repositories/leagueRepository";
import { TEAM_ERRORS } from "../../repositories/teamRepository";
import { unwrap } from "../../repositories/result";
import { LEAGUE_CLOSURE_ERRORS, LeagueService } from "../../services/league";
import { PlayerService } from "../../services/player";
import { TeamService } from "../../services/team";
import { LeaderboardService } from "../../services/leaderboard";
import {
  aLeague,
  anotherLeague,
  aPlayer,
  aTeamIn,
  unique,
} from "../support/subjects";
import { repositories } from "../support/target";
import type { League, Team } from "../../../../model";

/** A season still running, and one that ran out years ago. */
const RUNNING = "2126-01-01T00:00:00Z";
const RUN_OUT = "2020-01-01T00:00:00Z";

async function makePlayer(name: string) {
  const result = await new PlayerService(repositories()).createPlayer(
    name,
    `${name}@example.com`,
    `acct-${name}`,
  );
  if (!result.ok) throw new Error("setup failed");
  return result.value;
}

/** Whether a departure has been recorded against this player's team. */
async function hasLeft(playerId: string, leagueId: string): Promise<boolean> {
  const membership = unwrap(
    await repositories().teams.getMembership(playerId, leagueId),
    "membership",
  );
  return membership?.leftAt != null;
}

/**
 * A league founded by `adminId`, with the founding team the production writer
 * gives it. Every field is named because there is no default that would be right
 * for all of them — a lifecycle test turns on the season's end as often as on
 * who the admin is.
 */
async function seedLeague(attrs: {
  adminId: string;
  endDate: string;
}): Promise<League> {
  return (
    await aLeague(
      {
        name: unique("Lifecycle League"),
        adminId: attrs.adminId,
        startDate: Temporal.Instant.from("2024-01-01T00:00:00Z"),
        endDate: Temporal.Instant.from(attrs.endDate),
        domain: "en",
        languageScale: REFERENCE_SCALE,
        icon: LEAGUE_ICONS[0],
        visibility: LeagueVisibility.PUBLIC,
        invitePolicy: LeagueInvitePolicy.MEMBERS,
        invitationCode: null,
      },
      unique("Founders"),
    )
  ).league;
}

/** Closes a league the way its admin does. */
async function closeLeague(league: League): Promise<void> {
  unwrap(
    await repositories().leagues.close(
      league.id,
      league.adminId,
      Temporal.Instant.from("2026-01-01T00:00:00Z"),
    ),
    "closure",
  );
}

/** The team a league wrote for its founder. */
async function foundingTeam(league: League): Promise<Team> {
  const team = unwrap(
    await repositories().teams.getByPlayerAndLeague(league.adminId, league.id),
    "founding team",
  );
  if (team === null) throw new Error("league has no founding team");
  return team;
}

// ─── Service-level classification ────────────────────────────────────────────
//
// One sentinel comes back from each guarded write; these pin that the re-read
// turns it into the right named error, which is the half a caller sees.

describe("LeagueService.closeLeague", () => {
  it("closes the league and answers with the DTO the page can replace", async () => {
    const admin = await makePlayer("svc-admin");
    const league = await seedLeague({ adminId: admin.id, endDate: RUNNING });

    const result = await new LeagueService(repositories()).closeLeague(
      admin.id,
      league.id,
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
    const league = await seedLeague({ adminId: admin.id, endDate: RUNNING });

    const result = await new LeagueService(repositories()).closeLeague(
      member.id,
      league.id,
    );

    expect(result).toEqual({
      ok: false,
      error: LEAGUE_CLOSURE_ERRORS.NOT_ADMIN,
    });
  });

  it("names a repeat close rather than reporting one that did not happen", async () => {
    const admin = await makePlayer("svc-twice");
    const league = await seedLeague({ adminId: admin.id, endDate: RUNNING });
    const service = new LeagueService(repositories());

    expect((await service.closeLeague(admin.id, league.id)).ok).toBe(true);
    const result = await service.closeLeague(admin.id, league.id);

    expect(result).toEqual({
      ok: false,
      error: LEAGUE_CLOSURE_ERRORS.ALREADY_CLOSED,
    });
  });

  it("reports a league that is not there as not found", async () => {
    const result = await new LeagueService(repositories()).closeLeague(
      "whoever",
      "no-such-league",
    );

    expect(result).toEqual({ ok: false, error: LEAGUE_ERRORS.NOT_FOUND });
  });
});

describe("TeamService.createTeam — lifecycle refusals", () => {
  it("refuses a closed league by name", async () => {
    const player = await makePlayer("join-shut");
    const league = await seedLeague({
      adminId: await aPlayer(),
      endDate: RUNNING,
    });
    await closeLeague(league);

    const result = await new TeamService(repositories()).createTeam(
      player.id,
      league.id,
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
    const league = await seedLeague({
      adminId: await aPlayer(),
      endDate: RUN_OUT,
    });

    const result = await new TeamService(repositories()).createTeam(
      player.id,
      league.id,
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
  async function seedDeparted(teamName: string) {
    const player = await makePlayer(unique("rejoiner"));
    const league = await seedLeague({
      adminId: await aPlayer(),
      endDate: RUNNING,
    });
    const service = new TeamService(repositories());
    const team = unwrap(
      await service.createTeam(player.id, league.id, teamName),
      "team",
    );
    // The founder stays behind: the last member's departure would take the
    // league with it, leaving nothing to come back to.
    expect((await service.leaveLeague(player.id, league.id)).ok).toBe(true);
    return { service, player, leagueId: league.id, teamId: team.id };
  }

  it("puts a departed player back into the team they left", async () => {
    const { service, player, leagueId, teamId } = await seedDeparted("Gone XI");

    const result = await service.createTeam(player.id, leagueId, "Comeback FC");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The same row, renamed — not a second team beside the abandoned one.
    expect(result.value.id).toBe(teamId);
    expect(result.value.name).toBe("Comeback FC");
    expect(await hasLeft(player.id, leagueId)).toBe(false);
  });

  it("lets them keep the name they left under", async () => {
    // Their own departed row is still in the table; without excluding it, the
    // name check would find the returning player colliding with themselves.
    const { service, player, leagueId } = await seedDeparted("Gone XI");

    const result = await service.createTeam(player.id, leagueId, "Gone XI");

    expect(result.ok).toBe(true);
  });

  it("still refuses a name another team in the league holds", async () => {
    const { service, player, leagueId } = await seedDeparted("Gone XI");
    const rival = await makePlayer("rejoin-rival");
    unwrap(
      await service.createTeam(rival.id, leagueId, "Taken United"),
      "rival team",
    );

    const result = await service.createTeam(
      player.id,
      leagueId,
      "taken united",
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.NAME_TAKEN });
  });

  it("re-checks the league's entry rules on the way back in", async () => {
    // A private league they were invited into once: the invitation is not spent,
    // so coming back needs the code again, exactly as the first join did. Master
    // reached this by turning a public league private mid-test, which no
    // production path can do — a league's visibility is fixed when it is founded.
    const code = "ZK7QW";
    const player = await makePlayer("gated-rejoiner");
    const league = (
      await aLeague(
        {
          name: unique("Gated Lifecycle League"),
          adminId: await aPlayer(),
          startDate: Temporal.Instant.from("2024-01-01T00:00:00Z"),
          endDate: Temporal.Instant.from(RUNNING),
          domain: "en",
          languageScale: REFERENCE_SCALE,
          icon: LEAGUE_ICONS[0],
          visibility: LeagueVisibility.PRIVATE,
          invitePolicy: LeagueInvitePolicy.MEMBERS,
          invitationCode: code,
        },
        unique("Founders"),
      )
    ).league;
    const leagueId = league.id;
    const service = new TeamService(repositories());
    unwrap(
      await service.createTeam(player.id, leagueId, "Invited XI", code),
      "team",
    );
    expect((await service.leaveLeague(player.id, leagueId)).ok).toBe(true);

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
      code.toLowerCase(),
    );
    expect(allowed.ok).toBe(true);
  });

  it("refuses a second team to a player who never left", async () => {
    const player = await makePlayer("still-in");
    const league = await seedLeague({
      adminId: await aPlayer(),
      endDate: RUNNING,
    });
    const service = new TeamService(repositories());
    unwrap(
      await service.createTeam(player.id, league.id, "Present XI"),
      "team",
    );

    const result = await service.createTeam(player.id, league.id, "Second XI");

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.ALREADY_HAS_TEAM });
  });
});

describe("TeamService.leaveLeague", () => {
  async function seed() {
    const admin = await makePlayer(unique("la"));
    const member = await makePlayer(unique("lm"));
    const league = await seedLeague({ adminId: admin.id, endDate: RUNNING });
    // The founder is already in it, so the member's departure is never the last
    // one — which would delete the league instead of recording a leave.
    const team = unwrap(
      await new TeamService(repositories()).createTeam(
        member.id,
        league.id,
        unique("Leavers"),
      ),
      "team",
    );
    return { admin, member, leagueId: league.id, teamId: team.id };
  }

  it("lets a member walk away", async () => {
    const { member, leagueId } = await seed();

    const result = await new TeamService(repositories()).leaveLeague(
      member.id,
      leagueId,
    );

    expect(result.ok).toBe(true);
    expect(await hasLeft(member.id, leagueId)).toBe(true);
  });

  it("names a repeat departure", async () => {
    const { member, leagueId } = await seed();
    const service = new TeamService(repositories());
    expect((await service.leaveLeague(member.id, leagueId)).ok).toBe(true);

    const result = await service.leaveLeague(member.id, leagueId);

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.ALREADY_LEFT });
  });

  it("hands the league to the longest-standing member when its admin leaves", async () => {
    const { admin, member, leagueId } = await seed();

    const result = await new TeamService(repositories()).leaveLeague(
      admin.id,
      leagueId,
    );

    expect(result).toEqual({ ok: true, value: { leagueDeleted: false } });
    const league = unwrap(
      await repositories().leagues.getById(leagueId),
      "league",
    );
    // The member is the only one still playing, so seniority has nowhere else to
    // land — and what it must not land on is the admin who just walked out.
    expect(league.adminId).toBe(member.id);
    expect(await hasLeft(league.adminId, leagueId)).toBe(false);
  });

  it("deletes the league when its last member leaves, and everything under it", async () => {
    // The founding team is the only one, and founding gave it a line-up — so
    // this is the case where a departure empties the league.
    const admin = await makePlayer("solo-admin");
    const league = await seedLeague({ adminId: admin.id, endDate: RUNNING });
    const team = await foundingTeam(league);
    expect(
      unwrap(await repositories().lineups.getByTeamId(team.id), "lineup"),
    ).not.toBeNull();

    const result = await new TeamService(repositories()).leaveLeague(
      admin.id,
      league.id,
    );

    expect(result).toEqual({ ok: true, value: { leagueDeleted: true } });
    expect(await repositories().leagues.getById(league.id)).toEqual({
      ok: false,
      error: LEAGUE_ERRORS.NOT_FOUND,
    });
    // The cascade, not a second set of deletes: the team and its line-up go with
    // the league.
    expect(
      unwrap(
        await repositories().teams.getByIdAndLeague(team.id, league.id),
        "team",
      ),
    ).toBeNull();
    expect(
      unwrap(await repositories().lineups.getByTeamId(team.id), "lineup"),
    ).toBeNull();
  });

  it("keeps a league standing while anyone is still in it", async () => {
    const { member, leagueId } = await seed();

    const result = await new TeamService(repositories()).leaveLeague(
      member.id,
      leagueId,
    );

    expect(result).toEqual({ ok: true, value: { leagueDeleted: false } });
    expect((await repositories().leagues.getById(leagueId)).ok).toBe(true);
  });

  it("refuses the Global League by name", async () => {
    const player = await makePlayer("svc-globalleaver");
    unwrap(
      await new TeamService(repositories()).createTeam(
        player.id,
        GLOBAL_LEAGUE_ID,
        "Worldwide",
      ),
      "team",
    );

    const result = await new TeamService(repositories()).leaveLeague(
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
    const league = await anotherLeague();

    const result = await new TeamService(repositories()).leaveLeague(
      outsider.id,
      league.id,
    );

    expect(result).toEqual({
      ok: false,
      error: TEAM_ERRORS.NO_TEAM_IN_LEAGUE,
    });
  });

  it("refuses a closed league — there is nothing left to walk out of", async () => {
    const { admin, member, leagueId } = await seed();
    unwrap(
      await new LeagueService(repositories()).closeLeague(admin.id, leagueId),
      "closure",
    );

    const result = await new TeamService(repositories()).leaveLeague(
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
    // The team is written straight through the repository: the season is over, so
    // the join the service offers would be refused for that very reason, and this
    // test is about the *departure*.
    const league = await seedLeague({
      adminId: await aPlayer(),
      endDate: RUN_OUT,
    });
    const team = await aTeamIn(league.id);

    const result = await new TeamService(repositories()).leaveLeague(
      team.playerId,
      league.id,
    );

    expect(result).toEqual({
      ok: false,
      error: TEAM_ERRORS.LEAGUE_INACTIVE,
    });
    expect(await hasLeft(team.playerId, league.id)).toBe(false);
  });
});

// ─── What leaving means to the rest of the system ─────────────────────────────

describe("a departed player's league", () => {
  const DEPARTED_TEAM = "Departed XI";

  async function seedDeparture() {
    const member = await makePlayer(unique("dep-member"));
    const league = await seedLeague({
      adminId: await aPlayer(),
      endDate: RUNNING,
    });
    const teams = new TeamService(repositories());
    const team = unwrap(
      await teams.createTeam(member.id, league.id, DEPARTED_TEAM),
      "team",
    );
    unwrap(
      await repositories().contracts.create({
        teamId: team.id,
        articleId: "Some_Article",
        purchaseDate: Temporal.PlainDate.from("2026-01-01"),
        expireDate: Temporal.PlainDate.from("2126-01-08"),
        purchasePrice: 10,
      }),
      "contract",
    );
    expect((await teams.leaveLeague(member.id, league.id)).ok).toBe(true);
    return { member, league, teamId: team.id };
  }

  it("stops answering getMyTeam, which is what closes every scoped surface", async () => {
    // Contracts, lineup, market and the invite-code membership check all reach
    // the league through this one read, so none of them needs to know that
    // leaving exists.
    const { member, league } = await seedDeparture();

    const result = await new TeamService(repositories()).getMyTeam(
      member.id,
      league.id,
      "dep-member",
    );

    expect(result).toEqual({ ok: true, value: null });
  });

  it("keeps the team row and its whole ledger", async () => {
    // The point of the design: no contract, performance or standing is lost, so
    // the season stays exactly as auditable as it was while it was being played.
    const { member, league, teamId } = await seedDeparture();

    // Addressed by id rather than by player, because the player-scoped read is
    // the very one a departure closes.
    const team = unwrap(
      await repositories().teams.getByIdAndLeague(teamId, league.id),
      "team",
    );
    const contracts = unwrap(
      await repositories().contracts.getByTeamId(teamId),
      "contracts",
    );

    expect(team?.name).toBe(DEPARTED_TEAM);
    expect(await hasLeft(member.id, league.id)).toBe(true);
    expect(contracts).toHaveLength(1);
  });

  it("drops out of the leagues they play", async () => {
    const { member, league } = await seedDeparture();

    const result = await repositories().players.getLeaguesByPlayerId(member.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((l) => l.id)).not.toContain(league.id);
  });

  it("stops counting towards the league's size", async () => {
    // "How many teams play this league" is a question about now. Only the
    // founder's team is still playing.
    const { league } = await seedDeparture();

    const result = await repositories().leagues.countTeamsByLeague([league.id]);

    expect(result).toEqual({ ok: true, value: { [league.id]: 1 } });
  });

  it("keeps its place in the standings", async () => {
    // Erasing them would rewrite the league's history for everyone else too —
    // the ranks above and below them are only true with them in it.
    const { league } = await seedDeparture();

    const result = await new LeaderboardService(repositories()).getLeaderboard(
      league.id,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((e) => e.team.name)).toContain(DEPARTED_TEAM);
  });
});
