import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, it, expect, beforeEach } from "vitest";
import leagues from "../../routes/leagues";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import { LEAGUE_ERRORS } from "../../repositories/leagueRepository";
import { LeagueVisibility } from "../../../../model/enums";
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
