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
import { LEAGUE_ERRORS } from "../../repositories/leagueRepository";
import {
  LEAGUE_CREATION_ERRORS,
  LeagueService,
  parseCreateLeaguePayload,
} from "../../services/league";
import { PlayerService } from "../../services/player";
import { TeamService } from "../../services/team";
import { GLOBAL_LEAGUE_ID } from "../../../../model";
import type { CreateLeagueRequest } from "../../../../dto/leagueDTO";
import { REFERENCE_SCALE } from "../../../../model/languageScale";
import { LanguageScaleCalibrationService } from "../../services/languageScaleCalibration";
import { createWikimediaClient } from "../../services/wikimediaClient";
import { unwrap } from "../../repositories/result";
import { aLeague, aPlayer, unique } from "../support/subjects";
import { repositories } from "../support/target";
import type { League } from "../../../../model";

async function makePlayer(name: string) {
  const result = await new PlayerService(repositories()).createPlayer(
    name,
    `${name}@example.com`,
    `acct-${name}`,
  );
  if (!result.ok) throw new Error("setup failed");
  return result.value;
}

/** A season that is still running, and one that ended two years ago. */
const RUNNING = "2126-01-01T00:00:00Z";
const RUN_OUT = "2024-03-01T00:00:00Z";

/**
 * A league on the shelf, in the two terms this file's reads turn on: whether it
 * is offered to everyone, and whether its season is still going.
 */
async function seedLeague(attrs: {
  visibility: LeagueVisibility;
  invitationCode: string | null;
  endDate: string;
  adminId: string;
}): Promise<League> {
  return (
    await aLeague(
      {
        name: unique("Shelf League"),
        adminId: attrs.adminId,
        startDate: Temporal.Instant.from("2024-01-01T00:00:00Z"),
        endDate: Temporal.Instant.from(attrs.endDate),
        domain: "en",
        languageScale: REFERENCE_SCALE,
        icon: LEAGUE_ICONS[0],
        visibility: attrs.visibility,
        invitePolicy: LeagueInvitePolicy.MEMBERS,
        invitationCode: attrs.invitationCode,
      },
      unique("Founders"),
    )
  ).league;
}

/** A plain public league still in season — the shelf's ordinary case. */
async function seedOnTheShelf(): Promise<League> {
  return seedLeague({
    visibility: LeagueVisibility.PUBLIC,
    invitationCode: null,
    endDate: RUNNING,
    adminId: await aPlayer(),
  });
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

  it("accepts any well-formed language code, because the parser cannot know better", () => {
    // The rule this used to encode — a closed two-edition list — is gone (#531).
    // Which editions can host a league is now decided against live Wikimedia
    // data at the write boundary, so a pure parser's only remaining job is shape.
    expect(parseCreateLeaguePayload(request({ domain: "fr" })).ok).toBe(true);
    expect(parseCreateLeaguePayload(request({ domain: "pt-br" })).ok).toBe(
      true,
    );
    expect(parseCreateLeaguePayload(request({ domain: "simple" })).ok).toBe(
      true,
    );
  });

  it("refuses a domain that is not shaped like a language code at all", () => {
    // What the shape check is actually for: keeping junk out of the URL these
    // codes are interpolated into, before anything spends a request on it.
    for (const domain of [
      "",
      "EN",
      "../../etc/passwd",
      "en_US",
      "en.wikipedia",
    ]) {
      expect(parseCreateLeaguePayload(request({ domain }))).toEqual({
        ok: false,
        error: LEAGUE_CREATION_ERRORS.UNKNOWN_DOMAIN,
      });
    }
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
    service = new LeagueService(repositories());
  });

  it("lists public leagues and leaves private ones out entirely", async () => {
    const shopWindow = await seedOnTheShelf();
    const membersOnly = await seedLeague({
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: "ZK7QW",
      endDate: RUNNING,
      adminId: await aPlayer(),
    });

    const result = await service.getPublicLeagues();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.value.map((l) => l.id);
    expect(ids).toContain(shopWindow.id);
    // Absent because it is private — not filtered per-caller, so there is no
    // caller for whom this list would include it.
    expect(ids).not.toContain(membersOnly.id);
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
    const counted = await seedOnTheShelf();
    unwrap(
      await repositories().teams.create({
        name: "Counted FC",
        playerId: player.id,
        leagueId: counted.id,
      }),
      "team",
    );

    const result = await service.getPublicLeagues();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The founding team, and the one just added.
    expect(result.value.find((l) => l.id === counted.id)?.teamCount).toBe(2);
  });

  // The shelf is captioned as somewhere to go. Both halves of
  // `isLeagueInactive` are filtered in the query rather than by whoever renders
  // it, so the endpoint cannot offer a league whose join can only answer
  // TEAM_ERRORS.LEAGUE_INACTIVE (docs/domain/league-lifecycle.md).
  it("leaves out a public league whose season has run out", async () => {
    const lastSeason = await seedLeague({
      visibility: LeagueVisibility.PUBLIC,
      invitationCode: null,
      endDate: RUN_OUT,
      adminId: await aPlayer(),
    });

    const result = await service.getPublicLeagues();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((l) => l.id)).not.toContain(lastSeason.id);
  });

  it("leaves out a public league its admin closed early", async () => {
    // Season still running — only the closure puts it out, so this pins the
    // other half of the filter rather than re-testing the end date.
    const shutEarly = await seedOnTheShelf();
    unwrap(
      await repositories().leagues.close(
        shutEarly.id,
        shutEarly.adminId,
        Temporal.Instant.from("2026-01-01T00:00:00Z"),
      ),
      "closure",
    );

    const result = await service.getPublicLeagues();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((l) => l.id)).not.toContain(shutEarly.id);
  });

  it("never carries an invitation code, private or not", async () => {
    await seedOnTheShelf();

    const result = await service.getPublicLeagues();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result.value)).not.toContain("invitationCode");
  });

  it("stops at the limit it was given", async () => {
    for (let i = 0; i < 5; i++) {
      await seedOnTheShelf();
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
    service = new LeagueService({
      ...repositories(),
      calibration: new LanguageScaleCalibrationService({
        ...repositories(),
        wikimedia: createWikimediaClient(),
      }),
    });
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

    const team = await new TeamService(repositories()).getMyTeam(
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
    const lineup = unwrap(
      await repositories().lineups.getByTeamId(team.value!.id),
      "lineup",
    );
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
    const code = await repositories().leagues.getInvitationCode(
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
      await repositories().leagues.getInvitationCode(result.value.id),
    ).toEqual({ ok: true, value: null });
  });

  it("never puts the code in what it returns", async () => {
    // ADR 0008 §2: exactly one endpoint serves a code. Creation is the one
    // place it would be most tempting to bundle it in, so it is pinned here.
    const founder = await makePlayer("discreet");

    const result = await service.createLeague(founder.id, request());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const code = await repositories().leagues.getInvitationCode(
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

  it("names a lost code race as such, and not as a broken write", async () => {
    // `withUniqueInvitationCode` redraws only on this constant, so a
    // misclassification here would either retry an impossible write five times
    // or surface the storage layer's own wording to the client.
    const founder = await makePlayer("collider");
    const taken = await service.createLeague(founder.id, request());
    if (!taken.ok) throw new Error("setup failed");
    const code = await repositories().leagues.getInvitationCode(taken.value.id);
    if (!code.ok || code.value === null) throw new Error("no code issued");

    const second = await makePlayer("collider2");
    const result = await repositories().leagues.createWithFoundingTeam(
      {
        name: "Second",
        adminId: second.id,
        startDate: Temporal.Instant.from("2026-01-01T00:00:00Z"),
        endDate: Temporal.Instant.from("2026-02-01T00:00:00Z"),
        domain: "en",
        languageScale: REFERENCE_SCALE,
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
