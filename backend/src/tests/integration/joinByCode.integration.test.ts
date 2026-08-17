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
import { insertLeague, resetD1Database } from "../utils/d1TestUtils";

const CODE = "ZK7QW";
const OTHER_CODE = "M4RSX";

/**
 * The binding allows five code-bearing requests a minute per player, and it is
 * real in this pool rather than stubbed — so every test mints its own account,
 * exactly as `reportsRoute.integration.test.ts` has to. Reusing one would leak
 * spent quota into the next test and make failures depend on ordering.
 */
const RATE_LIMIT = 5;

async function makePlayerApp(): Promise<{ app: Hono; playerId: string }> {
  const accountId = `acct-join-${crypto.randomUUID()}`;
  const player = await new PlayerService(env.db).createPlayer(
    `joiner-${crypto.randomUUID()}`,
    "joiner@example.com",
    accountId,
  );
  if (!player.ok) throw new Error("setup failed");

  const app = new Hono<{ Bindings: Env }>()
    .use("*", async (c, next) => {
      c.set("jwtPayload", { sub: accountId });
      await next();
    })
    .route("/leagues", leagues);

  return { app, playerId: player.value.id };
}

function resolve(app: Hono, code: string) {
  return app.request(`/leagues/by-code/${encodeURIComponent(code)}`, {}, env);
}

function join(app: Hono, leagueId: string, body: unknown) {
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
  let app: Hono;

  beforeEach(async () => {
    await resetD1Database(env.db);
    ({ app } = await makePlayerApp());
    await insertLeague(env.db, {
      id: "coded",
      name: "Friday Night Wiki",
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: CODE,
    });
  });

  it("resolves a code to the league it opens", async () => {
    // The whole point of the endpoint: an invitation is something you can look
    // at before committing to it (docs/domain/league-visibility.md).
    const response = await resolve(app, CODE);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "coded",
      title: "Friday Night Wiki",
      visibility: LeagueVisibility.PRIVATE,
      teamCount: 0,
    });
  });

  it("accepts a code however it was pasted", async () => {
    // Lowercase, spaced and hyphenated — how one arrives out of a chat. The
    // shared `normalizeInvitationCode` is what makes this the same code, and
    // the join path normalizes through the very same function.
    const response = await resolve(app, " zk7-qw ");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: "coded" });
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
    await insertLeague(env.db, {
      id: "finished",
      endDate: "2020-01-01T00:00:00Z",
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: OTHER_CODE,
    });

    const response = await resolve(app, OTHER_CODE);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: "finished" });
  });
});

describe("the join rate limit", () => {
  let app: Hono;

  beforeEach(async () => {
    await resetD1Database(env.db);
    ({ app } = await makePlayerApp());
    await insertLeague(env.db, {
      id: "coded",
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: CODE,
    });
  });

  it("stops a caller grinding the resolve endpoint", async () => {
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
    for (let i = 0; i < RATE_LIMIT; i++) {
      expect((await resolve(app, OTHER_CODE)).status).toBe(404);
    }

    const response = await join(app, "coded", {
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
    for (let i = 0; i < RATE_LIMIT; i++) {
      expect((await resolve(app, OTHER_CODE)).status).toBe(404);
    }

    const response = await join(app, GLOBAL_LEAGUE_ID, {
      name: "Open Season",
    });

    expect(response.status).toBe(201);
  });

  it("lets a correct code through while budget remains", async () => {
    const response = await join(app, "coded", {
      name: "Invited XI",
      invitationCode: CODE,
    });

    expect(response.status).toBe(201);
  });
});

describe("joining a league that has ended", () => {
  let app: Hono;
  let playerId: string;

  beforeEach(async () => {
    await resetD1Database(env.db);
    ({ app, playerId } = await makePlayerApp());
  });

  it("refuses a season that has run out, code or no code", async () => {
    await insertLeague(env.db, {
      id: "expired",
      endDate: "2020-01-01T00:00:00Z",
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: CODE,
    });

    const response = await join(app, "expired", {
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
    await insertLeague(env.db, {
      id: "closed",
      closedAt: "2026-01-01T00:00:00Z",
    });

    const response = await join(app, "closed", { name: "Shut Out" });

    expect(response.status).toBe(409);
  });

  it("refuses the league's own admin as well", async () => {
    // Nobody is let back into an ended league — this is what makes it a state
    // of the league rather than a permission.
    await insertLeague(env.db, {
      id: "closed-mine",
      adminId: playerId,
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: CODE,
      closedAt: "2026-01-01T00:00:00Z",
    });

    const result = await new TeamService(env.db).createTeam(
      playerId,
      "closed-mine",
      "Founders XI",
    );

    expect(result).toEqual({ ok: false, error: TEAM_ERRORS.LEAGUE_INACTIVE });
  });

  it("still lets a running league be joined", async () => {
    // The guard has to be the *rule*, not a blanket refusal.
    await insertLeague(env.db, { id: "running" });

    const response = await join(app, "running", { name: "In Time FC" });

    expect(response.status).toBe(201);
  });
});

describe("LeagueService.getLeagueByInvitationCode", () => {
  let service: LeagueService;

  beforeEach(async () => {
    await resetD1Database(env.db);
    service = new LeagueService(env.db);
  });

  it("counts the teams already in the league it previews", async () => {
    // The preview is worth having because it answers "how many are playing";
    // going through `getLeagueById` is what supplies that, and is the reason
    // the repository call returns an id rather than a league.
    await insertLeague(env.db, {
      id: "sized",
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: CODE,
    });
    const player = await new PlayerService(env.db).createPlayer(
      "sizer",
      "sizer@example.com",
      "acct-sizer",
    );
    if (!player.ok) throw new Error("setup failed");
    await new TeamService(env.db).createTeam(
      player.value.id,
      "sized",
      "First In",
      CODE,
    );

    const result = await service.getLeagueByInvitationCode(CODE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.teamCount).toBe(1);
  });

  it("never matches a league that has no code at all", async () => {
    // A public league stores NULL there. SQL's NULL equals nothing — including
    // the empty string — but the shape check refuses long before the query
    // anyway, and both have to hold for this to stay true.
    await insertLeague(env.db, { id: "codeless" });

    await expect(service.getLeagueByInvitationCode("")).resolves.toEqual({
      ok: false,
      error: LEAGUE_ERRORS.NOT_FOUND,
    });
  });

  it("reads back a code a real league creation drew", async () => {
    // End to end against the writer, rather than against a hand-seeded row:
    // this is what would catch the two sides disagreeing on case or trimming.
    const player = await new PlayerService(env.db).createPlayer(
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
