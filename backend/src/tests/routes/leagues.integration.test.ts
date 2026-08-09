import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, it, expect, beforeEach } from "vitest";
import leagues from "../../routes/leagues";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import { LEAGUE_ERRORS } from "../../repositories/leagueRepository";
import { LeagueInvitePolicy, LeagueVisibility } from "../../../../model/enums";
import { LEAGUE_ICONS } from "../../../../model/league";
import { PlayerService } from "../../services/player";
import { insertLeague, resetD1Database } from "../utils/d1TestUtils";

const LEAGUE_ID = "league-route-1";

// The router is mounted bare rather than through `app`, because `/api/*` sits
// behind the JWT middleware and neither route under test reads the payload.
const app = new Hono<{ Bindings: { db: D1Database } }>().route(
  "/leagues",
  leagues,
);

describe("GET /leagues/:id", () => {
  beforeEach(async () => {
    await resetD1Database(env.db);
    await env.db
      .prepare(
        "INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        LEAGUE_ID,
        "Friday Night Wiki",
        "system",
        "2026-01-01T00:00:00Z",
        "2026-03-01T00:00:00Z",
        "it",
        "🍕",
      )
      .run();
  });

  it("returns the league named in the path", async () => {
    const response = await app.request(`/leagues/${LEAGUE_ID}`, {}, env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: LEAGUE_ID,
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
  const authed = new Hono<{ Bindings: { db: D1Database } }>()
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
    await resetD1Database(env.db);
    const player = await new PlayerService(env.db).createPlayer(
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

    const stored = await env.db
      .prepare("SELECT invitationCode FROM leagues WHERE id = ?")
      .bind(created.id)
      .first<{ invitationCode: string }>();

    expect(stored?.invitationCode).toBeTruthy();
    expect(JSON.stringify(created)).not.toContain(stored!.invitationCode);
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
  beforeEach(async () => {
    await resetD1Database(env.db);
    await insertLeague(env.db, {
      id: "leaky",
      visibility: LeagueVisibility.PRIVATE,
      invitationCode: "ZK7QW",
    });
  });

  it("keeps it out of GET /leagues/:id", async () => {
    const response = await app.request("/leagues/leaky", {}, env);
    const body = await response.json();

    expect(Object.keys(body as object)).not.toContain("invitationCode");
    expect(JSON.stringify(body)).not.toContain("ZK7QW");
  });

  it("keeps it out of GET /leagues/global", async () => {
    const response = await app.request("/leagues/global", {}, env);
    const body = await response.json();

    expect(Object.keys(body as object)).not.toContain("invitationCode");
  });

  it("still reports the league's visibility, which is not a secret", async () => {
    const response = await app.request("/leagues/leaky", {}, env);

    await expect(response.json()).resolves.toMatchObject({
      id: "leaky",
      visibility: LeagueVisibility.PRIVATE,
    });
  });
});
