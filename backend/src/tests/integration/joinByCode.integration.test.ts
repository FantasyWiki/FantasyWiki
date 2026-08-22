import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, it, expect, beforeEach } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { GLOBAL_LEAGUE_ID } from "../../../../model";
import { LeagueVisibility } from "../../../../model/enums";
import leagues, { JOIN_RATE_LIMITED } from "../../routes/leagues";
import { LEAGUE_ERRORS } from "../../repositories/leagueRepository";
import { TEAM_ERRORS } from "../../repositories/teamRepository";
import { LeagueService } from "../../services/league";
import { TeamService } from "../../services/team";
import { PlayerService } from "../../services/player";
import { injectDeps } from "../support/injectDeps";
import { LanguageScaleCalibrationService } from "../../services/languageScaleCalibration";
import { createWikimediaClient } from "../../services/wikimediaClient";
import { LeagueInvitePolicy } from "../../../../model/enums";
import { LEAGUE_ICONS } from "../../../../model/league";
import { REFERENCE_SCALE } from "../../../../model/languageScale";
import { unwrap } from "../../repositories/result";
import { aLeague, aPlayer } from "../support/subjects";
import { repositories } from "../support/target";
import { aWindowWithRoomToSpendIt } from "../support/rateLimitWindow";
import type { League } from "../../../../model";

const CODE = "ZK7QW";
const OTHER_CODE = "M4RSX";

/** A season that is still running, and one that ran out years ago. */
const RUNNING = "2126-01-01T00:00:00Z";
const RUN_OUT = "2020-01-01T00:00:00Z";

/**
 * A league in the three terms this file is about: how you get into it, when its
 * season ends, and whose it is. Every one of them is named at the call site,
 * because every one of them is what some test here turns on.
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
        name: "Friday Night Wiki",
        adminId: attrs.adminId,
        startDate: Temporal.Instant.from("2026-01-01T00:00:00Z"),
        endDate: Temporal.Instant.from(attrs.endDate),
        domain: "en",
        languageScale: REFERENCE_SCALE,
        icon: LEAGUE_ICONS[0],
        visibility: attrs.visibility,
        invitePolicy: LeagueInvitePolicy.MEMBERS,
        invitationCode: attrs.invitationCode,
      },
      "Founders",
    )
  ).league;
}

/** Closes a league the way its admin does, since `closedAt` is never written directly. */
async function close(league: League): Promise<void> {
  unwrap(
    await repositories().leagues.close(
      league.id,
      league.adminId,
      Temporal.Instant.from("2026-01-01T00:00:00Z"),
    ),
    "closure",
  );
}

/**
 * The binding allows five code-bearing requests a minute per player, and it is
 * real in this pool rather than stubbed — so every test mints its own account,
 * exactly as `reportsRoute.integration.test.ts` has to. Reusing one would leak
 * spent quota into the next test and make failures depend on ordering.
 */
const RATE_LIMIT = 5;

/**
 * All these helpers need of the app is to drive requests at it — and the
 * instance the builder returns carries the middleware chain in its type, which
 * a bare `Hono` annotation will not accept.
 */
type TestApp = Pick<Hono, "request">;

async function makePlayerApp(): Promise<{ app: TestApp; playerId: string }> {
  const accountId = `acct-join-${crypto.randomUUID()}`;
  const player = await new PlayerService(repositories()).createPlayer(
    `joiner-${crypto.randomUUID()}`,
    "joiner@example.com",
    accountId,
  );
  if (!player.ok) throw new Error("setup failed");

  const app = new Hono()
    .use("*", injectDeps())
    .use("*", async (c, next) => {
      c.set("jwtPayload", { sub: accountId });
      await next();
    })
    .route("/leagues", leagues);

  return { app, playerId: player.value.id };
}

function resolve(app: TestApp, code: string) {
  return app.request(`/leagues/by-code/${encodeURIComponent(code)}`, {}, env);
}

function join(app: TestApp, leagueId: string, body: unknown) {
  return app.request(
    `/leagues/${leagueId}/my-team`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
  );
}

describe("GET /leagues/by-code/:code", () => {
  let app: TestApp;
  let coded: League;

  beforeEach(async () => {
    ({ app } = await makePlayerApp());
    coded = await seedLeague({
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: CODE,
      endDate: RUNNING,
      adminId: await aPlayer(),
    });
  });

  it("resolves a code to the league it opens", async () => {
    // The whole point of the endpoint: an invitation is something you can look
    // at before committing to it (docs/domain/league-visibility.md).
    const response = await resolve(app, CODE);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: coded.id,
      title: "Friday Night Wiki",
      visibility: LeagueVisibility.PRIVATE,
      teamCount: 1,
    });
  });

  it("accepts a code however it was pasted", async () => {
    // Lowercase, spaced and hyphenated — how one arrives out of a chat. The
    // shared `normalizeInvitationCode` is what makes this the same code, and
    // the join path normalizes through the very same function.
    const response = await resolve(app, " zk7-qw ");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: coded.id });
  });

  it("never carries the code it was asked about", async () => {
    // The mirror of the "never rides on a league read" rule in
    // routes/leagues.integration.test.ts: this read is keyed *by* the
    // credential, which makes echoing it back the easiest mistake here.
    const response = await resolve(app, CODE);
    const body = await response.json();

    expect(Object.keys(body as object)).not.toContain("invitationCode");
    expect(JSON.stringify(body)).not.toContain(CODE);
  });

  it("is not shadowed by /leagues/:id", async () => {
    // `/by-code/:code` is registered before `/:id`; Hono matches in
    // registration order, and swapping the two would turn this into a lookup
    // for a league whose id is literally "by-code".
    const response = await resolve(app, CODE);

    expect(response.status).toBe(200);
  });

  /**
   * ADR 0008 §3 refuses to tell "code missing" from "code wrong" on the join
   * path. A preview endpoint that told a well-formed unused code from a
   * malformed one would hand back exactly the oracle that refusal denies —
   * "your generator is aimed correctly" is the one bit a guesser wants.
   */
  it("answers a wrong code, an unused code and a bad shape identically", async () => {
    const wrong = await resolve(app, OTHER_CODE);
    const malformed = await resolve(app, "abc");
    // Contains the excluded letters (O, I, U) — the right length, the wrong
    // alphabet.
    const offAlphabet = await resolve(app, "OIU00");

    for (const response of [wrong, malformed, offAlphabet]) {
      expect(response.status).toBe(404);
    }

    const bodies = await Promise.all(
      [wrong, malformed, offAlphabet].map((r) => r.json()),
    );
    expect(bodies[0]).toEqual({ error: LEAGUE_ERRORS.NOT_FOUND });
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
  });

  it("answers a league that does not exist the same way too", async () => {
    // The id-keyed read of a missing league, for comparison: the code path must
    // be indistinguishable from it.
    const byId = await app.request("/leagues/nope", {}, env);
    const byCode = await resolve(app, OTHER_CODE);

    expect(byId.status).toBe(byCode.status);
    await expect(byId.json()).resolves.toEqual(await byCode.json());
  });

  it("still resolves a league whose season is over", async () => {
    // Deliberate. Someone holding a real invitation should be told the season
    // ended, not that their code is bad — the preview carries `endDate` and
    // `closedAt` and the surface reaches that verdict itself.
    const finished = await seedLeague({
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: OTHER_CODE,
      endDate: RUN_OUT,
      adminId: await aPlayer(),
    });

    const response = await resolve(app, OTHER_CODE);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: finished.id });
  });
});

describe("the join rate limit", () => {
  let app: TestApp;
  let coded: League;

  beforeEach(async () => {
    ({ app } = await makePlayerApp());
    coded = await seedLeague({
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: CODE,
      endDate: RUNNING,
      adminId: await aPlayer(),
    });
  });

  it("stops a caller grinding the resolve endpoint", async () => {
    await aWindowWithRoomToSpendIt();
    for (let i = 0; i < RATE_LIMIT; i++) {
      expect((await resolve(app, OTHER_CODE)).status).toBe(404);
    }

    const response = await resolve(app, OTHER_CODE);

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: JOIN_RATE_LIMITED,
    });
  });

  /**
   * The reason both paths share one binding. Two buckets would let a guesser
   * alternate between resolving and redeeming for twice the attempts, and the
   * shared namespace would be an unenforced comment without this.
   */
  it("spends one budget across resolving and redeeming", async () => {
    await aWindowWithRoomToSpendIt();
    for (let i = 0; i < RATE_LIMIT; i++) {
      expect((await resolve(app, OTHER_CODE)).status).toBe(404);
    }

    const response = await join(app, coded.id, {
      name: "Late Arrival",
      invitationCode: OTHER_CODE,
    });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: JOIN_RATE_LIMITED,
    });
  });

  it("leaves a join that presents no code alone", async () => {
    // Signup and the public-league shelf both post without a code, and neither
    // is a guessing surface — a codeless join learns only "this league is
    // private", which is the same sentence for every private league there is.
    await aWindowWithRoomToSpendIt();
    for (let i = 0; i < RATE_LIMIT; i++) {
      expect((await resolve(app, OTHER_CODE)).status).toBe(404);
    }

    const response = await join(app, GLOBAL_LEAGUE_ID, {
      name: "Open Season",
    });

    expect(response.status).toBe(201);
  });

  it("lets a correct code through while budget remains", async () => {
    const response = await join(app, coded.id, {
      name: "Invited XI",
      invitationCode: CODE,
    });

    expect(response.status).toBe(201);
  });
});

describe("joining a league that has ended", () => {
  let app: TestApp;
  let playerId: string;

  beforeEach(async () => {
    ({ app, playerId } = await makePlayerApp());
  });

  it("refuses a season that has run out, code or no code", async () => {
    const expired = await seedLeague({
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: CODE,
      endDate: RUN_OUT,
      adminId: await aPlayer(),
    });

    const response = await join(app, expired.id, {
      name: "Too Late FC",
      invitationCode: CODE,
    });

    // 409, not 403: the refusal is about the league's state, and a valid code
    // does not change it.
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: TEAM_ERRORS.LEAGUE_INACTIVE,
    });
  });

  it("refuses a public league the admin closed early", async () => {
    // The other half of `isLeagueInactive`, and the half a date comparison
    // alone would miss.
    const closed = await seedLeague({
      visibility: LeagueVisibility.PUBLIC,
      invitationCode: null,
      endDate: RUNNING,
      adminId: await aPlayer(),
    });
    await close(closed);

    const response = await join(app, closed.id, { name: "Shut Out" });

    expect(response.status).toBe(409);
  });

  it("refuses the league's own admin as well", async () => {
    // Nobody is let back into an ended league — this is what makes it a state
    // of the league rather than a permission.
    const mine = await seedLeague({
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: CODE,
      endDate: RUNNING,
      adminId: playerId,
    });
    await close(mine);

    const result = await new TeamService(repositories()).createTeam(
      playerId,
      mine.id,
      "Founders XI",
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAGUE_INACTIVE });
  });

  it("still lets a running league be joined", async () => {
    // The guard has to be the *rule*, not a blanket refusal.
    const running = await seedLeague({
      visibility: LeagueVisibility.PUBLIC,
      invitationCode: null,
      endDate: RUNNING,
      adminId: await aPlayer(),
    });

    const response = await join(app, running.id, { name: "In Time FC" });

    expect(response.status).toBe(201);
  });
});

describe("LeagueService.getLeagueByInvitationCode", () => {
  let service: LeagueService;

  beforeEach(async () => {
    service = new LeagueService({
      ...repositories(),
      calibration: new LanguageScaleCalibrationService({
        ...repositories(),
        wikimedia: createWikimediaClient(),
      }),
    });
  });

  it("counts the teams already in the league it previews", async () => {
    // The preview is worth having because it answers "how many are playing";
    // going through `getLeagueById` is what supplies that, and is the reason
    // the repository call returns an id rather than a league.
    const sized = await seedLeague({
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: CODE,
      endDate: RUNNING,
      adminId: await aPlayer(),
    });
    const player = await new PlayerService(repositories()).createPlayer(
      "sizer",
      "sizer@example.com",
      "acct-sizer",
    );
    if (!player.ok) throw new Error("setup failed");
    await new TeamService(repositories()).createTeam(
      player.value.id,
      sized.id,
      "First In",
      CODE,
    );

    const result = await service.getLeagueByInvitationCode(CODE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The founding team, plus the one that just redeemed the code.
    expect(result.value.teamCount).toBe(2);
  });

  it("never matches a league that has no code at all", async () => {
    // A public league is stored with no code at all. An absent code matches
    // nothing — including the empty string — but the shape check refuses long
    // before the lookup anyway, and both have to hold for this to stay true.
    await seedLeague({
      visibility: LeagueVisibility.PUBLIC,
      invitationCode: null,
      endDate: RUNNING,
      adminId: await aPlayer(),
    });

    await expect(service.getLeagueByInvitationCode("")).resolves.toEqual({
      ok: false,
      error: LEAGUE_ERRORS.NOT_FOUND,
    });
  });

  it("reads back a code a real league creation drew", async () => {
    // End to end against the writer, rather than against a hand-seeded row:
    // this is what would catch the two sides disagreeing on case or trimming.
    const player = await new PlayerService(repositories()).createPlayer(
      "founder",
      "founder@example.com",
      "acct-founder",
    );
    if (!player.ok) throw new Error("setup failed");

    const created = await service.createLeague(player.value.id, {
      name: "Drawn Code League",
      icon: "🏆",
      domain: "en",
      duration: "1m",
      visibility: LeagueVisibility.PRIVATE,
      invitePolicy: "members" as never,
      teamName: "Founders XI",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const code = await service.getInvitationCode(
      player.value.id,
      created.value.id,
      true,
    );
    expect(code.ok).toBe(true);
    if (!code.ok) return;

    const resolved = await service.getLeagueByInvitationCode(code.value.code);

    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.id).toBe(created.value.id);
    // And it is still running, which is what makes the preview's join button
    // live rather than an explanation of why it is not.
    expect(
      Temporal.Instant.compare(resolved.value.endDate, Temporal.Now.instant()),
    ).toBeGreaterThan(0);
  });
});
