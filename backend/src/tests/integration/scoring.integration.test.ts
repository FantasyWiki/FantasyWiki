import { Temporal } from "@js-temporal/polyfill";
import { env } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";
import { ScoringService } from "../../services/scoring";
import { PerformanceService } from "../../services/performance";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import {
  resetD1Database,
  insertTeam,
  insertLineup,
  insertContract,
} from "../utils/d1TestUtils";

const SCORE_DATE = "2026-07-12";
const SCORE_DAY = Temporal.PlainDate.from(SCORE_DATE);
const TEAM_ID = "team-score-1";
const PLAYER_ID = "player-score-1";

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
      await insertContract(env.db, {
        id: "c-active",
        teamId: TEAM_ID,
        articleId: "Active_Article",
        purchaseDate: "2026-07-01",
        expireDate: "2026-07-15",
      });
      await insertContract(env.db, {
        id: "c-expired",
        teamId: TEAM_ID,
        articleId: "Expired_Article",
        purchaseDate: "2026-06-01",
        expireDate: "2026-06-10",
      });
      await insertContract(env.db, {
        id: "c-settled",
        teamId: TEAM_ID,
        articleId: "Settled_Article",
        purchaseDate: "2026-07-01",
        expireDate: "2026-07-15",
        settled: 1,
      });
      await insertLineup(env.db, TEAM_ID, "4-3-3", {
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
      await insertContract(env.db, {
        id: "c-lb",
        teamId: TEAM_ID,
        articleId: "Left_Back",
        purchaseDate: "2026-07-01",
        expireDate: "2026-07-15",
      });
      await insertContract(env.db, {
        id: "c-clb",
        teamId: TEAM_ID,
        articleId: "Centre_Back",
        purchaseDate: "2026-07-01",
        expireDate: "2026-07-15",
      });
      await insertLineup(env.db, TEAM_ID, "4-3-3", {
        LB: "c-lb",
        CLB: "c-clb",
      });

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
    beforeEach(async () => {
      // The team must have a lineup so getTeamLineups() resolves its domain -> L.
      await insertLineup(env.db, TEAM_ID, "4-3-3", {});
    });

    it("computes points from raw signals and upserts idempotently on (teamId, date)", async () => {
      const scoring = ScoringService.fromDb(env.db);
      const performance = PerformanceService.fromDb(env.db);

      // domain "en" -> L = 1.0. basePoints(64000)=5.0, basePoints(16000)=3.0;
      // "excellent" synergy = +1.5 -> 5.0 + 3.0 + 1.5 = 9.5.
      const first = await scoring.ingestPerformances(SCORE_DAY, [
        {
          teamId: TEAM_ID,
          articleViews: [64_000, 16_000],
          chemistryLevels: ["excellent"],
          formationSnapshot: JSON.stringify({ ST: "Active_Article" }),
        },
      ]);
      expect(first.ok).toBe(true);
      if (first.ok) expect(first.value.written).toBe(1);

      const afterFirst = await performance.getRecentForTeam(TEAM_ID, 5);
      expect(afterFirst.ok).toBe(true);
      if (!afterFirst.ok) return;
      expect(afterFirst.value).toHaveLength(1);
      expect(afterFirst.value[0].points).toBeCloseTo(9.5);

      // Re-run the same day with different signals: still one row, recomputed.
      // basePoints(4000)=1.0, no chemistry -> 1.0.
      const second = await scoring.ingestPerformances(SCORE_DAY, [
        {
          teamId: TEAM_ID,
          articleViews: [4_000],
          chemistryLevels: [],
          formationSnapshot: JSON.stringify({ ST: "Active_Article" }),
        },
      ]);
      expect(second.ok).toBe(true);

      const afterSecond = await performance.getRecentForTeam(TEAM_ID, 5);
      expect(afterSecond.ok).toBe(true);
      if (!afterSecond.ok) return;
      expect(afterSecond.value).toHaveLength(1);
      expect(afterSecond.value[0].points).toBeCloseTo(1.0);
    });

    it("rejects negative or non-finite article views", async () => {
      const scoring = ScoringService.fromDb(env.db);
      const negative = await scoring.ingestPerformances(SCORE_DAY, [
        {
          teamId: TEAM_ID,
          articleViews: [-1],
          chemistryLevels: [],
          formationSnapshot: "{}",
        },
      ]);
      expect(negative.ok).toBe(false);
    });

    it("rejects an unknown chemistry level", async () => {
      const scoring = ScoringService.fromDb(env.db);
      const bad = await scoring.ingestPerformances(SCORE_DAY, [
        {
          teamId: TEAM_ID,
          articleViews: [4_000],
          // Deliberately not a ChemistryLevel value.
          chemistryLevels: ["mutual" as never],
          formationSnapshot: "{}",
        },
      ]);
      expect(bad.ok).toBe(false);
    });

    it("rejects a team with no lineup (no resolvable domain)", async () => {
      const scoring = ScoringService.fromDb(env.db);
      const unknown = await scoring.ingestPerformances(SCORE_DAY, [
        {
          teamId: "team-without-lineup",
          articleViews: [4_000],
          chemistryLevels: [],
          formationSnapshot: "{}",
        },
      ]);
      expect(unknown.ok).toBe(false);
    });
  });
});
