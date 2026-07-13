import { Temporal } from "@js-temporal/polyfill";
import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../../index";
import { ScoringService } from "../../services/scoring";
import { PerformanceService } from "../../services/performance";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import { resetD1Database, insertTeam } from "../utils/d1TestUtils";

const SCORE_DATE = "2026-07-12";
const SCORE_DAY = Temporal.PlainDate.from(SCORE_DATE);
const TEAM_ID = "team-score-1";
const PLAYER_ID = "player-score-1";
const AUTH = { Authorization: "Bearer test-scoring-secret" };

async function insertLineup(
  teamId: string,
  schema: string,
  formation: Record<string, string>,
): Promise<void> {
  await env.db
    .prepare(
      "INSERT INTO lineups (teamId, schema, formation, updatedAt) VALUES (?, ?, ?, ?)",
    )
    .bind(teamId, schema, JSON.stringify(formation), new Date().toISOString())
    .run();
}

async function insertContract(opts: {
  id: string;
  teamId: string;
  articleId: string;
  purchaseDate: string;
  expireDate: string;
  settled?: number;
}): Promise<void> {
  await env.db
    .prepare(
      "INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice, settled) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      opts.id,
      opts.teamId,
      opts.articleId,
      opts.purchaseDate,
      opts.expireDate,
      10,
      opts.settled ?? 0,
    )
    .run();
}

describe("Scoring engine integration", () => {
  beforeEach(async () => {
    await resetD1Database(env.db);
    await env.db
      .prepare(
        "INSERT INTO google_accounts (id, googleId, email) VALUES (?, ?, ?)",
      )
      .bind("acc-score-1", "gid-score-1", "score@example.com")
      .run();
    await env.db
      .prepare("INSERT INTO players (id, username, accountId) VALUES (?, ?, ?)")
      .bind(PLAYER_ID, "scoreplayer", "acc-score-1")
      .run();
    await insertTeam(env.db, {
      id: TEAM_ID,
      name: "Score FC",
      playerId: PLAYER_ID,
      leagueId: GLOBAL_LEAGUE_ID, // domain "en"
    });
  });

  describe("getScoringInputs", () => {
    it("resolves placements only for active contracts (drops expired & settled)", async () => {
      await insertContract({
        id: "c-active",
        teamId: TEAM_ID,
        articleId: "Active_Article",
        purchaseDate: "2026-07-01",
        expireDate: "2026-07-15",
      });
      await insertContract({
        id: "c-expired",
        teamId: TEAM_ID,
        articleId: "Expired_Article",
        purchaseDate: "2026-06-01",
        expireDate: "2026-06-10",
      });
      await insertContract({
        id: "c-settled",
        teamId: TEAM_ID,
        articleId: "Settled_Article",
        purchaseDate: "2026-07-01",
        expireDate: "2026-07-15",
        settled: 1,
      });
      await insertLineup(TEAM_ID, "4-3-3", {
        ST: "c-active",
        LW: "c-expired",
        GK: "c-settled",
      });

      const service = ScoringService.fromDb(env.db);
      const result = await service.getScoringInputs(SCORE_DAY);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const forTeam = result.value.find((i) => i.teamId === TEAM_ID);
      expect(forTeam).toBeDefined();
      expect(forTeam!.domain).toBe("en");
      // Only the active contract's article is scorable (expired + settled dropped).
      expect(forTeam!.articles).toEqual(["Active_Article"]);
      // The engine receives no schema/positions — the opaque snapshot carries them.
      expect(JSON.parse(forTeam!.formationSnapshot)).toEqual({
        ST: "Active_Article",
      });
    });

    it("resolves chemistry links to article pairs (backend owns the topology)", async () => {
      // Two 4-3-3 positions joined by a Chemistry Link: LB <-> CLB.
      await insertContract({
        id: "c-lb",
        teamId: TEAM_ID,
        articleId: "Left_Back",
        purchaseDate: "2026-07-01",
        expireDate: "2026-07-15",
      });
      await insertContract({
        id: "c-clb",
        teamId: TEAM_ID,
        articleId: "Centre_Back",
        purchaseDate: "2026-07-01",
        expireDate: "2026-07-15",
      });
      await insertLineup(TEAM_ID, "4-3-3", { LB: "c-lb", CLB: "c-clb" });

      const service = ScoringService.fromDb(env.db);
      const result = await service.getScoringInputs(SCORE_DAY);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const forTeam = result.value.find((i) => i.teamId === TEAM_ID);
      expect(forTeam!.chemistryLinks).toContainEqual([
        "Left_Back",
        "Centre_Back",
      ]);
    });
  });

  describe("ingestPerformances", () => {
    it("upserts idempotently on (teamId, date) and is readable back", async () => {
      const scoring = ScoringService.fromDb(env.db);
      const performance = PerformanceService.fromDb(env.db);

      const first = await scoring.ingestPerformances(SCORE_DAY, [
        {
          teamId: TEAM_ID,
          points: 21.23,
          formationSnapshot: JSON.stringify({ ST: "Active_Article" }),
        },
      ]);
      expect(first.ok).toBe(true);
      if (first.ok) expect(first.value.written).toBe(1);

      const afterFirst = await performance.getRecentForTeam(TEAM_ID, 5);
      expect(afterFirst.ok).toBe(true);
      if (!afterFirst.ok) return;
      expect(afterFirst.value).toHaveLength(1);
      expect(afterFirst.value[0].points).toBeCloseTo(21.23);

      // Re-run the same day with a different score: still one row, updated.
      const second = await scoring.ingestPerformances(SCORE_DAY, [
        {
          teamId: TEAM_ID,
          points: 30,
          formationSnapshot: JSON.stringify({ ST: "Active_Article" }),
        },
      ]);
      expect(second.ok).toBe(true);

      const afterSecond = await performance.getRecentForTeam(TEAM_ID, 5);
      expect(afterSecond.ok).toBe(true);
      if (!afterSecond.ok) return;
      expect(afterSecond.value).toHaveLength(1);
      expect(afterSecond.value[0].points).toBeCloseTo(30);
    });

    it("rejects negative or non-finite points", async () => {
      const scoring = ScoringService.fromDb(env.db);
      const negative = await scoring.ingestPerformances(SCORE_DAY, [
        { teamId: TEAM_ID, points: -1, formationSnapshot: "{}" },
      ]);
      expect(negative.ok).toBe(false);
    });
  });

  describe("route auth (/internal/*)", () => {
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
      await insertContract({
        id: "c-active",
        teamId: TEAM_ID,
        articleId: "Active_Article",
        purchaseDate: "2026-07-01",
        expireDate: "2026-07-15",
      });
      await insertLineup(TEAM_ID, "4-3-3", { ST: "c-active" });

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
});
