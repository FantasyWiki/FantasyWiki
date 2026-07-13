import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../../index";
import { PerformanceService } from "../../services/performance";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import {
  resetD1Database,
  insertTeam,
  insertLineup,
  insertContract,
} from "../utils/d1TestUtils";

const SCORE_DATE = "2026-07-12";
const TEAM_ID = "team-internal-1";
const PLAYER_ID = "player-internal-1";
const AUTH = { Authorization: "Bearer test-scoring-secret" };

describe("/internal routes", () => {
  beforeEach(async () => {
    await resetD1Database(env.db);
    await env.db
      .prepare(
        "INSERT INTO google_accounts (id, googleId, email) VALUES (?, ?, ?)",
      )
      .bind("acc-internal-1", "gid-internal-1", "internal@example.com")
      .run();
    await env.db
      .prepare("INSERT INTO players (id, username, accountId) VALUES (?, ?, ?)")
      .bind(PLAYER_ID, "internalplayer", "acc-internal-1")
      .run();
    await insertTeam(env.db, {
      id: TEAM_ID,
      name: "Internal FC",
      playerId: PLAYER_ID,
      leagueId: GLOBAL_LEAGUE_ID, // domain "en"
    });
  });

  it("rejects a missing or wrong bearer token with 401", async () => {
    const noAuth = await app.request(
      `/internal/scoring-inputs?date=${SCORE_DATE}`,
      {},
      env,
    );
    expect(noAuth.status).toBe(401);

    const wrong = await app.request(
      `/internal/scoring-inputs?date=${SCORE_DATE}`,
      { headers: { Authorization: "Bearer nope" } },
      env,
    );
    expect(wrong.status).toBe(401);
  });

  it("rejects a malformed or missing date with 400 (authed)", async () => {
    const badFormat = await app.request(
      "/internal/scoring-inputs?date=2026/07/12",
      { headers: { ...AUTH } },
      env,
    );
    expect(badFormat.status).toBe(400);

    const missing = await app.request(
      "/internal/scoring-inputs",
      { headers: { ...AUTH } },
      env,
    );
    expect(missing.status).toBe(400);

    const postBadDate = await app.request(
      "/internal/performances",
      {
        method: "POST",
        headers: { ...AUTH, "Content-Type": "application/json" },
        body: JSON.stringify({ date: "not-a-date", results: [] }),
      },
      env,
    );
    expect(postBadDate.status).toBe(400);
  });

  it("serves inputs and ingests results with a valid token", async () => {
    await insertContract(env.db, {
      id: "c-active",
      teamId: TEAM_ID,
      articleId: "Active_Article",
      purchaseDate: "2026-07-01",
      expireDate: "2026-07-15",
    });
    await insertLineup(env.db, TEAM_ID, "4-3-3", { ST: "c-active" });

    const getRes = await app.request(
      `/internal/scoring-inputs?date=${SCORE_DATE}`,
      { headers: { ...AUTH } },
      env,
    );
    expect(getRes.status).toBe(200);
    const inputs = (await getRes.json()) as Array<{
      teamId: string;
      articles: string[];
    }>;
    expect(inputs.find((i) => i.teamId === TEAM_ID)?.articles).toEqual([
      "Active_Article",
    ]);

    const postRes = await app.request(
      "/internal/performances",
      {
        method: "POST",
        headers: { ...AUTH, "Content-Type": "application/json" },
        body: JSON.stringify({
          date: SCORE_DATE,
          results: [
            {
              teamId: TEAM_ID,
              points: 12.5,
              formationSnapshot: JSON.stringify({ ST: "Active_Article" }),
            },
          ],
        }),
      },
      env,
    );
    expect(postRes.status).toBe(200);
    const body = (await postRes.json()) as { written: number };
    expect(body.written).toBe(1);

    const performance = PerformanceService.fromDb(env.db);
    const rows = await performance.getRecentForTeam(TEAM_ID, 5);
    expect(rows.ok).toBe(true);
    if (rows.ok) expect(rows.value[0].points).toBeCloseTo(12.5);
  });
});
