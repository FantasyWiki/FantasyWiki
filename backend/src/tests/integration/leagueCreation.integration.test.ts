import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import {
  INVITATION_CODE_ALPHABET,
  INVITATION_CODE_LENGTH,
  LEAGUE_DURATION_DAYS,
  LEAGUE_ICONS,
} from "../../../../model/league";
import { LeagueInvitePolicy, LeagueVisibility } from "../../../../model/enums";
import { STARTING_CREDITS } from "../../../../model/team";
import { LeagueRepositoryD1 } from "../../repositories/d1/leagueRepositoryD1";
import { LEAGUE_ERRORS } from "../../repositories/leagueRepository";
import {
  LEAGUE_CREATION_ERRORS,
  LeagueService,
  parseCreateLeaguePayload,
} from "../../services/league";
import { PlayerService } from "../../services/player";
import { TeamService } from "../../services/team";
import { GLOBAL_LEAGUE_ID } from "../../../../model";
import { insertLeague, insertTeam } from "../utils/d1TestUtils";
import type { CreateLeagueRequest } from "../../../../dto/leagueDTO";

async function makePlayer(name: string) {
  const result = await new PlayerService(env.db).createPlayer(
    name,
    `${name}@example.com`,
    `acct-${name}`,
  );
  if (!result.ok) throw new Error("setup failed");
  return result.value;
}

function request(
  overrides: Partial<CreateLeagueRequest> = {},
): CreateLeagueRequest {
  return {
    name: "Sunday Scholars",
    icon: LEAGUE_ICONS[0],
    domain: "en",
    duration: "1m",
    visibility: LeagueVisibility.PRIVATE,
    invitePolicy: LeagueInvitePolicy.MEMBERS,
    teamName: "Wiki Wanderers",
    ...overrides,
  };
}

describe("parseCreateLeaguePayload", () => {
  it("accepts a well-formed payload and trims the two names", () => {
    const result = parseCreateLeaguePayload(
      request({ name: "  Sunday Scholars  ", teamName: "  Wanderers  " }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Sunday Scholars");
    expect(result.value.teamName).toBe("Wanderers");
  });

  it("refuses a body that is not an object at all", () => {
    expect(parseCreateLeaguePayload(null)).toEqual({
      ok: false,
      error: LEAGUE_CREATION_ERRORS.INVALID_PAYLOAD,
    });
    expect(parseCreateLeaguePayload("league")).toEqual({
      ok: false,
      error: LEAGUE_CREATION_ERRORS.INVALID_PAYLOAD,
    });
  });

  it("refuses a name that is only whitespace", () => {
    // `.trim()` runs before the length check, so "   " is two characters short
    // rather than three characters long.
    expect(parseCreateLeaguePayload(request({ name: "   " }))).toEqual({
      ok: false,
      error: LEAGUE_CREATION_ERRORS.NAME_LENGTH,
    });
  });

  it("refuses an icon outside the palette", () => {
    // The column is rendered literally in every league list, so this is the
    // check that keeps arbitrary request text off the screen.
    expect(
      parseCreateLeaguePayload(request({ icon: "<script>alert(1)</script>" })),
    ).toEqual({ ok: false, error: LEAGUE_CREATION_ERRORS.UNKNOWN_ICON });
  });

  it("refuses an edition the game does not run yet", () => {
    // Narrow on purpose until #531 sources the list from Wikipedia itself.
    expect(
      parseCreateLeaguePayload(
        request({ domain: "fr" as CreateLeagueRequest["domain"] }),
      ),
    ).toEqual({ ok: false, error: LEAGUE_CREATION_ERRORS.UNKNOWN_DOMAIN });
  });

  it("refuses a duration it was not offered", () => {
    // The client names a length, never an end date — so it cannot name one in
    // the past, and cannot ask for a season too short to hold a LONG contract.
    expect(
      parseCreateLeaguePayload(
        request({ duration: "10y" as CreateLeagueRequest["duration"] }),
      ),
    ).toEqual({ ok: false, error: LEAGUE_CREATION_ERRORS.UNKNOWN_DURATION });
  });

  it("insists on an invite policy even for a public league", () => {
    // The form hides the field when the league is public, but an absent value
    // would be read back by `toLeague` as `admin` — a policy nobody chose,
    // waiting for the day the league turns private.
    expect(
      parseCreateLeaguePayload({ ...request(), invitePolicy: undefined }),
    ).toEqual({
      ok: false,
      error: LEAGUE_CREATION_ERRORS.UNKNOWN_INVITE_POLICY,
    });
  });

  it("refuses a founding team name that breaks the team rules", () => {
    expect(parseCreateLeaguePayload(request({ teamName: "ab" }))).toEqual({
      ok: false,
      error: LEAGUE_CREATION_ERRORS.TEAM_NAME_LENGTH,
    });
  });
});

describe("LeagueService.getPublicLeagues", () => {
  let service: LeagueService;

  beforeEach(() => {
    service = new LeagueService(env.db);
  });

  it("lists public leagues and leaves private ones out entirely", async () => {
    await insertLeague(env.db, { id: "shop-window" });
    await insertLeague(env.db, {
      id: "members-only",
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: "ZK7QW",
    });

    const result = await service.getPublicLeagues();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.value.map((l) => l.id);
    expect(ids).toContain("shop-window");
    // Absent because it is private — not filtered per-caller, so there is no
    // caller for whom this list would include it.
    expect(ids).not.toContain("members-only");
  });

  it("includes the Global League, which every player is already in", async () => {
    // The list is deliberately not caller-scoped: dropping the leagues someone
    // already plays is the rendering surface's job, not the query's.
    const result = await service.getPublicLeagues();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((l) => l.id)).toContain(GLOBAL_LEAGUE_ID);
  });

  it("reports how many teams play each one", async () => {
    const player = await makePlayer("browser");
    await insertLeague(env.db, { id: "counted" });
    await insertTeam(env.db, {
      id: "t-counted",
      name: "Counted FC",
      playerId: player.id,
      leagueId: "counted",
    });

    const result = await service.getPublicLeagues();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.find((l) => l.id === "counted")?.teamCount).toBe(1);
  });

  // The shelf is captioned as somewhere to go. Both halves of
  // `isLeagueInactive` are filtered in the query rather than by whoever renders
  // it, so the endpoint cannot offer a league whose join can only answer
  // TEAM_ERRORS.LEAGUE_INACTIVE (docs/domain/league-lifecycle.md).
  it("leaves out a public league whose season has run out", async () => {
    await insertLeague(env.db, {
      id: "last-season",
      startDate: "2024-01-01T00:00:00Z",
      endDate: "2024-03-01T00:00:00Z",
    });

    const result = await service.getPublicLeagues();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((l) => l.id)).not.toContain("last-season");
  });

  it("leaves out a public league its admin closed early", async () => {
    // Season still running — only `closedAt` puts it out, so this pins the
    // other half of the filter rather than re-testing the end date.
    await insertLeague(env.db, {
      id: "shut-early",
      closedAt: "2026-01-01T00:00:00Z",
    });

    const result = await service.getPublicLeagues();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((l) => l.id)).not.toContain("shut-early");
  });

  it("never carries an invitation code, private or not", async () => {
    await insertLeague(env.db, { id: "leaky-shelf" });

    const result = await service.getPublicLeagues();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result.value)).not.toContain("invitationCode");
  });

  it("stops at the limit it was given", async () => {
    for (let i = 0; i < 5; i++) {
      await insertLeague(env.db, { id: `bulk-${i}` });
    }

    const result = await service.getPublicLeagues(3);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(3);
  });
});

describe("LeagueService.createLeague", () => {
  let service: LeagueService;

  beforeEach(() => {
    service = new LeagueService(env.db);
  });

  it("writes the league, its founder's team and that team's lineup together", async () => {
    const founder = await makePlayer("founder");

    const result = await service.createLeague(founder.id, request());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const league = result.value;
    expect(league.title).toBe("Sunday Scholars");
    // Exactly one team, and it is the founder's — reported without a count
    // query, so this is what proves the team row was actually written.
    expect(league.teamCount).toBe(1);

    const team = await new TeamService(env.db).getMyTeam(
      founder.id,
      league.id,
      founder.username,
    );
    expect(team.ok).toBe(true);
    if (!team.ok) return;
    expect(team.value?.name).toBe("Wiki Wanderers");
    expect(team.value?.credits).toBe(STARTING_CREDITS);

    // Without this row `getLineup` fails outright, so the founder would be
    // locked out of the first screen they open.
    const lineup = await env.db
      .prepare("SELECT schema FROM lineups WHERE teamId = ?")
      .bind(team.value!.id)
      .first<{ schema: string }>();
    expect(lineup?.schema).toBe("4-3-3");
  });

  it("runs the season from now for exactly the length asked for", async () => {
    const founder = await makePlayer("timekeeper");

    const result = await service.createLeague(
      founder.id,
      request({ duration: "3m" }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const elapsedDays =
      result.value.endDate.epochMilliseconds -
      result.value.startDate.epochMilliseconds;
    expect(elapsedDays).toBe(LEAGUE_DURATION_DAYS["3m"] * 24 * 60 * 60 * 1000);
  });

  it("issues a private league a code from the shared alphabet", async () => {
    const founder = await makePlayer("host");

    const result = await service.createLeague(founder.id, request());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const code = await new LeagueRepositoryD1(env.db).getInvitationCode(
      result.value.id,
    );
    expect(code.ok).toBe(true);
    if (!code.ok || code.value === null) throw new Error("no code issued");
    expect(code.value).toHaveLength(INVITATION_CODE_LENGTH);
    for (const character of code.value) {
      expect(INVITATION_CODE_ALPHABET).toContain(character);
    }
  });

  it("gives a public league no code, because there is nothing to guard", async () => {
    const founder = await makePlayer("opener");

    const result = await service.createLeague(
      founder.id,
      request({ visibility: LeagueVisibility.PUBLIC }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      await new LeagueRepositoryD1(env.db).getInvitationCode(result.value.id),
    ).toEqual({ ok: true, value: null });
  });

  it("never puts the code in what it returns", async () => {
    // ADR 0008 §2: exactly one endpoint serves a code. Creation is the one
    // place it would be most tempting to bundle it in, so it is pinned here.
    const founder = await makePlayer("discreet");

    const result = await service.createLeague(founder.id, request());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const code = await new LeagueRepositoryD1(env.db).getInvitationCode(
      result.value.id,
    );
    if (!code.ok || code.value === null) throw new Error("no code issued");
    expect(JSON.stringify(result.value)).not.toContain(code.value);
    expect(result.value).not.toHaveProperty("invitationCode");
  });

  it("hands the founder their own code straight away", async () => {
    // The creation response deliberately omits it, so this is the round trip
    // the success screen actually makes — it has to work the moment the
    // league exists, which it does only because the founder is now a member.
    const founder = await makePlayer("sharer");
    const created = await service.createLeague(founder.id, request());
    if (!created.ok) throw new Error("setup failed");

    const result = await service.getInvitationCode(
      founder.id,
      created.value.id,
      true,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.code).toHaveLength(INVITATION_CODE_LENGTH);
  });

  it("leaves no league behind when the founding team cannot be written", async () => {
    // The whole reason the two rows share a transaction, and the only test that
    // demonstrates it — so the statement that fails has to be the *second* one.
    // A bad `adminId` would not do: `leagues.adminId` is itself a foreign key,
    // so the league INSERT would fail first and nothing would ever attempt the
    // team. A null team name passes the league write and then trips
    // `teams.name NOT NULL`, which is exactly the shape being guarded against.
    const founder = await makePlayer("doomed");
    const before = await env.db
      .prepare("SELECT COUNT(*) AS n FROM leagues")
      .first<{ n: number }>();

    const result = await new LeagueRepositoryD1(env.db).createWithFoundingTeam(
      {
        name: "Doomed",
        adminId: founder.id,
        startDate: Temporal.Instant.from("2026-01-01T00:00:00Z"),
        endDate: Temporal.Instant.from("2026-02-01T00:00:00Z"),
        domain: "en",
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

  it("names a lost code race as such, and not as a broken write", async () => {
    // `withUniqueInvitationCode` redraws only on this constant, so a
    // misclassification here would either retry an impossible write five times
    // or surface SQLite's own wording to the client.
    const founder = await makePlayer("collider");
    const taken = await service.createLeague(founder.id, request());
    if (!taken.ok) throw new Error("setup failed");
    const code = await new LeagueRepositoryD1(env.db).getInvitationCode(
      taken.value.id,
    );
    if (!code.ok || code.value === null) throw new Error("no code issued");

    const second = await makePlayer("collider2");
    const result = await new LeagueRepositoryD1(env.db).createWithFoundingTeam(
      {
        name: "Second",
        adminId: second.id,
        startDate: Temporal.Instant.from("2026-01-01T00:00:00Z"),
        endDate: Temporal.Instant.from("2026-02-01T00:00:00Z"),
        domain: "en",
        visibility: LeagueVisibility.PRIVATE,
        invitePolicy: LeagueInvitePolicy.MEMBERS,
        icon: LEAGUE_ICONS[0],
        invitationCode: code.value,
      },
      "Second XI",
    );

    expect(result).toEqual({
      ok: false,
      error: LEAGUE_ERRORS.INVITATION_CODE_TAKEN,
    });
  });
});
