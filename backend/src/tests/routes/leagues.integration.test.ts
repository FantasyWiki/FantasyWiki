import { env } from "cloudflare:workers";
import { Temporal } from "@js-temporal/polyfill";
import { Hono } from "hono";
import { describe, it, expect, beforeEach } from "vitest";
import leagues from "../../routes/leagues";
import { GLOBAL_LEAGUE_ID, LEAGUE_CLOSURE_ERRORS } from "../../services/league";
import { LEAGUE_ERRORS } from "../../repositories/leagueRepository";
import { unwrap } from "../../repositories/result";
import { TEAM_ERRORS } from "../../repositories/teamRepository";
import { REFERENCE_SCALE } from "../../../../model/languageScale";
import { LeagueInvitePolicy, LeagueVisibility } from "../../../../model/enums";
import { LEAGUE_ICONS } from "../../../../model/league";
import { PlayerService } from "../../services/player";
import { injectDeps } from "../support/injectDeps";
import { aLeague, anotherLeague, aPlayer } from "../support/subjects";
import { repositories } from "../support/target";

// The router is mounted bare rather than through `app`, because `/api/*` sits
// behind the JWT middleware and neither route under test reads the payload.
const app = new Hono().use("*", injectDeps()).route("/leagues", leagues);

describe("GET /leagues/:id", () => {
  // A second league, so the response is distinguishable from the Global one.
  let leagueId: string;

  beforeEach(async () => {
    leagueId = (
      await aLeague(
        {
          name: "Friday Night Wiki",
          adminId: await aPlayer(),
          startDate: Temporal.Instant.from("2026-01-01T00:00:00Z"),
          endDate: Temporal.Instant.from("2026-03-01T00:00:00Z"),
          domain: "it",
          languageScale: REFERENCE_SCALE,
          icon: "🍕",
          visibility: LeagueVisibility.PUBLIC,
          invitePolicy: LeagueInvitePolicy.MEMBERS,
          invitationCode: null,
        },
        "Pizza Founders",
      )
    ).league.id;
  });

  it("returns the league named in the path", async () => {
    const response = await app.request(`/leagues/${leagueId}`, {}, env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: leagueId,
      title: "Friday Night Wiki",
      domain: "it",
      icon: "🍕",
    });
  });

  it("returns 404 for a league that does not exist", async () => {
    const response = await app.request("/leagues/no-such-league", {}, env);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: LEAGUE_ERRORS.NOT_FOUND,
    });
  });

  // `/global` is a literal path that also matches `/:id`. Hono resolves in
  // registration order, so this is what keeps the wildcard from swallowing it —
  // and what would fail if the two were ever reordered.
  it("does not shadow /leagues/global", async () => {
    const response = await app.request("/leagues/global", {}, env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: GLOBAL_LEAGUE_ID,
      title: "Global League",
    });
  });
});

/**
 * The one rule that makes a private league private: the invitation code must
 * never leave through a league read. `GET /leagues/:id` is unscoped by design,
 * so a code on `LeagueDTO` could be lifted off a public endpoint and used to
 * walk straight through the gate it guards. These assertions are what would
 * catch someone adding it to the DTO "for convenience".
 */
describe("POST /leagues", () => {
  // This route, unlike the reads above, resolves the founder from the session,
  // so the payload the JWT middleware would have set is stood in for here.
  const GOOGLE_ACCOUNT_ID = "acct-route-founder";
  const authed = new Hono()
    .use("*", injectDeps())
    .use("*", async (c, next) => {
      c.set("jwtPayload", { sub: GOOGLE_ACCOUNT_ID });
      await next();
    })
    .route("/leagues", leagues);

  function body(overrides: Record<string, unknown> = {}) {
    return {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Friday Night Wiki",
        icon: LEAGUE_ICONS[0],
        domain: "en",
        duration: "1m",
        visibility: LeagueVisibility.PRIVATE,
        invitePolicy: LeagueInvitePolicy.MEMBERS,
        teamName: "Wiki Wanderers",
        ...overrides,
      }),
    };
  }

  beforeEach(async () => {
    const player = await new PlayerService(repositories()).createPlayer(
      "route-founder",
      "route-founder@example.com",
      GOOGLE_ACCOUNT_ID,
    );
    if (!player.ok) throw new Error("setup failed");
  });

  it("answers 201 with the new league", async () => {
    const response = await authed.request("/leagues", body(), env);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      title: "Friday Night Wiki",
      visibility: LeagueVisibility.PRIVATE,
      teamCount: 1,
    });
  });

  it("keeps the invitation code out of the creation response too", async () => {
    const response = await authed.request("/leagues", body(), env);
    const created = (await response.json()) as { id: string };

    const storedCode = unwrap(
      await repositories().leagues.getInvitationCode(created.id),
      "invitation code",
    );

    expect(storedCode).toBeTruthy();
    expect(JSON.stringify(created)).not.toContain(storedCode);
  });

  it("answers 400, not 500, for a payload it cannot accept", async () => {
    const response = await authed.request(
      "/leagues",
      body({ duration: "10y" }),
      env,
    );

    expect(response.status).toBe(400);
  });

  it("answers 400 for a body that is not JSON at all", async () => {
    const response = await authed.request(
      "/leagues",
      { method: "POST", body: "not json" },
      env,
    );

    expect(response.status).toBe(400);
  });
});

describe("the invitation code never rides on a league read", () => {
  const CODE = "ZK7QW";
  let leakyId: string;

  beforeEach(async () => {
    leakyId = (
      await aLeague(
        {
          name: "Leaky League",
          adminId: await aPlayer(),
          startDate: Temporal.Instant.from("2026-01-01T00:00:00Z"),
          endDate: Temporal.Instant.from("2126-01-01T00:00:00Z"),
          domain: "en",
          languageScale: REFERENCE_SCALE,
          icon: "🕵️",
          visibility: LeagueVisibility.PRIVATE,
          invitePolicy: LeagueInvitePolicy.MEMBERS,
          invitationCode: CODE,
        },
        "Leaky Founders",
      )
    ).league.id;
  });

  it("keeps it out of GET /leagues/:id", async () => {
    const response = await app.request(`/leagues/${leakyId}`, {}, env);
    const body = await response.json();

    expect(Object.keys(body as object)).not.toContain("invitationCode");
    expect(JSON.stringify(body)).not.toContain(CODE);
  });

  it("keeps it out of GET /leagues/global", async () => {
    const response = await app.request("/leagues/global", {}, env);
    const body = await response.json();

    expect(Object.keys(body as object)).not.toContain("invitationCode");
  });

  it("still reports the league's visibility, which is not a secret", async () => {
    const response = await app.request(`/leagues/${leakyId}`, {}, env);

    await expect(response.json()).resolves.toMatchObject({
      id: leakyId,
      visibility: LeagueVisibility.PRIVATE,
    });
  });
});

/**
 * The two lifecycle endpoints, exercised for the one thing only a route test
 * can see: the status each named error maps to. The rules themselves are
 * pinned in `leagueLifecycle.integration.test.ts`.
 *
 * Both are a `POST` on a noun rather than a `DELETE`, because neither removes
 * anything (docs/domain/league-lifecycle.md).
 */
describe("league lifecycle endpoints", () => {
  const ADMIN_ACCOUNT = "acct-route-admin";
  const MEMBER_ACCOUNT = "acct-route-member";
  let leagueId: string;

  function authedAs(accountId: string) {
    return new Hono()
      .use("*", injectDeps())
      .use("*", async (c, next) => {
        c.set("jwtPayload", { sub: accountId });
        await next();
      })
      .route("/leagues", leagues);
  }

  beforeEach(async () => {
    const players = new PlayerService(repositories());
    const admin = await players.createPlayer(
      "route-admin",
      "route-admin@example.com",
      ADMIN_ACCOUNT,
    );
    const member = await players.createPlayer(
      "route-member",
      "route-member@example.com",
      MEMBER_ACCOUNT,
    );
    if (!admin.ok || !member.ok) throw new Error("setup failed");

    // The admin's own team arrives with the league; the member's is the second,
    // which is what makes the admin's departure a hand-over rather than a
    // closure.
    leagueId = (
      await aLeague(
        {
          name: "Lifecycle League",
          adminId: admin.value.id,
          startDate: Temporal.Instant.from("2026-01-01T00:00:00Z"),
          endDate: Temporal.Instant.from("2126-01-01T00:00:00Z"),
          domain: "en",
          languageScale: REFERENCE_SCALE,
          icon: "🔁",
          visibility: LeagueVisibility.PUBLIC,
          invitePolicy: LeagueInvitePolicy.MEMBERS,
          invitationCode: null,
        },
        "Founders",
      )
    ).league.id;
    unwrap(
      await repositories().teams.create({
        name: "Challengers",
        playerId: member.value.id,
        leagueId,
      }),
      "member team",
    );
  });

  it("answers 200 with the closed league for its admin", async () => {
    const response = await authedAs(ADMIN_ACCOUNT).request(
      `/leagues/${leagueId}/closure`,
      { method: "POST" },
      env,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { closedAt: string | null };
    expect(body.closedAt).not.toBeNull();
  });

  it("answers 403 when someone other than the admin tries to close", async () => {
    const response = await authedAs(MEMBER_ACCOUNT).request(
      `/leagues/${leagueId}/closure`,
      { method: "POST" },
      env,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: LEAGUE_CLOSURE_ERRORS.NOT_ADMIN,
    });
  });

  it("answers 409 on a second close", async () => {
    const app = authedAs(ADMIN_ACCOUNT);
    await app.request(`/leagues/${leagueId}/closure`, { method: "POST" }, env);

    const response = await app.request(
      `/leagues/${leagueId}/closure`,
      { method: "POST" },
      env,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: LEAGUE_CLOSURE_ERRORS.ALREADY_CLOSED,
    });
  });

  it("answers 404 when closing a league that is not there", async () => {
    const response = await authedAs(ADMIN_ACCOUNT).request(
      "/leagues/no-such-league/closure",
      { method: "POST" },
      env,
    );

    expect(response.status).toBe(404);
  });

  it("answers 200 when a member leaves", async () => {
    const response = await authedAs(MEMBER_ACCOUNT).request(
      `/leagues/${leagueId}/my-departure`,
      { method: "POST" },
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ leagueDeleted: false });
  });

  it("lets the admin leave, handing the league to whoever remains", async () => {
    const response = await authedAs(ADMIN_ACCOUNT).request(
      `/leagues/${leagueId}/my-departure`,
      { method: "POST" },
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ leagueDeleted: false });
  });

  it("answers 409 on a second departure", async () => {
    const app = authedAs(MEMBER_ACCOUNT);
    await app.request(
      `/leagues/${leagueId}/my-departure`,
      { method: "POST" },
      env,
    );

    const response = await app.request(
      `/leagues/${leagueId}/my-departure`,
      { method: "POST" },
      env,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: TEAM_ERRORS.ALREADY_LEFT,
    });
  });

  it("answers 404 when a non-member tries to leave", async () => {
    const elsewhere = await anotherLeague();

    const response = await authedAs(MEMBER_ACCOUNT).request(
      `/leagues/${elsewhere.id}/my-departure`,
      { method: "POST" },
      env,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: TEAM_ERRORS.NO_TEAM_IN_LEAGUE,
    });
  });

  it("answers 409 when joining a closed league", async () => {
    await authedAs(ADMIN_ACCOUNT).request(
      `/leagues/${leagueId}/closure`,
      { method: "POST" },
      env,
    );
    const outsider = await new PlayerService(repositories()).createPlayer(
      "route-outsider",
      "route-outsider@example.com",
      "acct-route-outsider",
    );
    if (!outsider.ok) throw new Error("setup failed");

    const response = await authedAs("acct-route-outsider").request(
      `/leagues/${leagueId}/my-team`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Too Late FC" }),
      },
      env,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: TEAM_ERRORS.LEAGUE_INACTIVE,
    });
  });
});

/**
 * Both routes below resolve the caller from the session, so neither works
 * without `currentPlayer` in front of it. Registered without the middleware they
 * still type-check — `c.var.player` is declared on the context whether or not
 * the middleware that fills it has run — and then throw on the first
 * dereference, which Hono answers 500. That is how the dashboard's recent-points
 * card broke: every logged-in player got a 500 from `my-performances`, and
 * neither route had a test to say otherwise. The status codes are the whole
 * assertion here; a 500 means the guard has gone missing again.
 */
describe("the self-scoped routes resolve the caller from the session", () => {
  const GOOGLE_ACCOUNT_ID = "acct-route-self-scoped";
  const authed = new Hono()
    .use("*", injectDeps())
    .use("*", async (c, next) => {
      c.set("jwtPayload", { sub: GOOGLE_ACCOUNT_ID });
      await next();
    })
    .route("/leagues", leagues);

  let leagueId: string;

  beforeEach(async () => {
    const player = unwrap(
      await repositories().players.save({
        username: "self-scoped-caller",
        accountId: GOOGLE_ACCOUNT_ID,
        email: "self-scoped-caller@example.com",
      }),
      "player",
    );
    // Founded by the caller, so the session's player has a team in it and the
    // routes get past their "no team in league" answer to the part that needs
    // the player at all.
    leagueId = (
      await aLeague(
        {
          name: "Session Scoped FC",
          adminId: player.id,
          startDate: Temporal.Instant.from("2026-01-01T00:00:00Z"),
          endDate: Temporal.Instant.from("2126-01-01T00:00:00Z"),
          domain: "en",
          languageScale: REFERENCE_SCALE,
          icon: "🌍",
          visibility: LeagueVisibility.PUBLIC,
          invitePolicy: LeagueInvitePolicy.MEMBERS,
          invitationCode: null,
        },
        "Session Scoped Founders",
      )
    ).league.id;
  });

  it("answers GET /:id/my-performances with the session's team's points", async () => {
    const response = await authed.request(
      `/leagues/${leagueId}/my-performances?limit=2`,
      {},
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });

  it("answers PUT /:id/lineup for the session's team", async () => {
    const response = await authed.request(
      `/leagues/${leagueId}/lineup`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formation: { date: "2026-08-19", schema: "4-3-3", formation: {} },
          bench: [],
        }),
      },
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
