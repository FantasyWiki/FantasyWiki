import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import { ScoringService } from "../../services/scoring";
import { PerformanceService } from "../../services/performance";
import { PlayerService } from "../../services/player";
import { TeamService } from "../../services/team";
import { LineupService } from "../../services/lineup";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import { unwrap } from "../../repositories/result";
import { repositories } from "../support/target";
import type { Contract } from "../../../../model";

const SCORE_DATE = "2026-07-12";
const SCORE_DAY = Temporal.PlainDate.from(SCORE_DATE);

describe("Scoring engine integration", () => {
  let playerId: string;
  let teamId: string;

  /** A contract the team holds over the given window. */
  async function hold(
    articleId: string,
    from: string,
    to: string,
  ): Promise<Contract> {
    return unwrap(
      await repositories().contracts.create({
        teamId,
        articleId,
        purchaseDate: Temporal.PlainDate.from(from),
        expireDate: Temporal.PlainDate.from(to),
        purchasePrice: 10,
      }),
      `contract on ${articleId}`,
    );
  }

  /** Held, then sold: settled, so no longer scorable. */
  async function sold(
    articleId: string,
    from: string,
    to: string,
  ): Promise<Contract> {
    const contract = await hold(articleId, from, to);
    unwrap(
      await repositories().contracts.settleSale(contract.id, teamId, 5),
      `sale of ${articleId}`,
    );
    return contract;
  }

  async function fieldThem(
    schema: string,
    formation: Record<string, string>,
  ): Promise<void> {
    const positions: Record<string, unknown> = {};
    for (const [position, contractId] of Object.entries(formation)) {
      positions[position] = { id: contractId };
    }
    unwrap(
      await new LineupService({
        ...repositories(),
        teamService: new TeamService(repositories()),
      }).saveLineup(playerId, GLOBAL_LEAGUE_ID, {
        formation: {
          date: SCORE_DATE,
          schema,
          formation: positions as never,
        },
        bench: [],
      }),
      "lineup",
    );
  }

  beforeEach(async () => {
    playerId = unwrap(
      await new PlayerService(repositories()).createPlayer(
        "scoreplayer",
        "score@example.com",
        "acc-score-1",
      ),
      "player",
    ).id;
    // The Global League's domain is "en", which fixes the language scale at 1.0.
    teamId = unwrap(
      await new TeamService(repositories()).createTeam(
        playerId,
        GLOBAL_LEAGUE_ID,
        "Score FC",
      ),
      "team",
    ).id;
  });

  describe("getScoringInputs", () => {
    it("resolves placements only for active contracts (drops expired & settled)", async () => {
      const active = await hold("Active_Article", "2026-07-01", "2026-07-15");
      const expired = await hold("Expired_Article", "2026-06-01", "2026-06-10");
      const settled = await sold("Settled_Article", "2026-07-01", "2026-07-15");
      await fieldThem("4-3-3", {
        ST: active.id,
        LW: expired.id,
        GK: settled.id,
      });

      const service = new ScoringService(repositories());
      const result = await service.getScoringInputs(SCORE_DAY);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const forTeam = result.value.find((i) => i.teamId === teamId);
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
      const leftBack = await hold("Left_Back", "2026-07-01", "2026-07-15");
      const centreBack = await hold("Centre_Back", "2026-07-01", "2026-07-15");
      await fieldThem("4-3-3", { LB: leftBack.id, CLB: centreBack.id });

      const service = new ScoringService(repositories());
      const result = await service.getScoringInputs(SCORE_DAY);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const forTeam = result.value.find((i) => i.teamId === teamId);
      expect(forTeam!.chemistryLinks).toContainEqual([
        "Left_Back",
        "Centre_Back",
      ]);
    });
  });

  describe("ingestPerformances", () => {
    beforeEach(async () => {
      // The team must have a lineup so getTeamLineups() resolves its domain -> L.
      await fieldThem("4-3-3", {});
    });

    it("computes points from raw signals and upserts idempotently on (teamId, date)", async () => {
      const scoring = new ScoringService(repositories());
      const performance = new PerformanceService(repositories());

      // domain "en" -> L = 1.0. basePoints(64000)=5.0, basePoints(16000)=3.0;
      // "excellent" synergy = +1.5 -> 5.0 + 3.0 + 1.5 = 9.5.
      const first = await scoring.ingestPerformances(SCORE_DAY, [
        {
          teamId,
          articleViews: [64_000, 16_000],
          chemistryLevels: ["excellent"],
          formationSnapshot: JSON.stringify({ ST: "Active_Article" }),
        },
      ]);
      expect(first.ok).toBe(true);
      if (first.ok) expect(first.value.written).toBe(1);

      const afterFirst = await performance.getRecentForTeam(teamId, 5);
      expect(afterFirst.ok).toBe(true);
      if (!afterFirst.ok) return;
      expect(afterFirst.value).toHaveLength(1);
      expect(afterFirst.value[0].points).toBeCloseTo(9.5);

      // Re-run the same day with different signals: still one row, recomputed.
      // basePoints(4000)=1.0, no chemistry -> 1.0.
      const second = await scoring.ingestPerformances(SCORE_DAY, [
        {
          teamId,
          articleViews: [4_000],
          chemistryLevels: [],
          formationSnapshot: JSON.stringify({ ST: "Active_Article" }),
        },
      ]);
      expect(second.ok).toBe(true);

      const afterSecond = await performance.getRecentForTeam(teamId, 5);
      expect(afterSecond.ok).toBe(true);
      if (!afterSecond.ok) return;
      expect(afterSecond.value).toHaveLength(1);
      expect(afterSecond.value[0].points).toBeCloseTo(1.0);
    });

    it("rejects negative or non-finite article views", async () => {
      const scoring = new ScoringService(repositories());
      const negative = await scoring.ingestPerformances(SCORE_DAY, [
        {
          teamId,
          articleViews: [-1],
          chemistryLevels: [],
          formationSnapshot: "{}",
        },
      ]);
      expect(negative.ok).toBe(false);
    });

    it("rejects an unknown chemistry level", async () => {
      const scoring = new ScoringService(repositories());
      const bad = await scoring.ingestPerformances(SCORE_DAY, [
        {
          teamId,
          articleViews: [4_000],
          // Deliberately not a ChemistryLevel value.
          chemistryLevels: ["mutual" as never],
          formationSnapshot: "{}",
        },
      ]);
      expect(bad.ok).toBe(false);
    });

    it("rejects a team with no lineup (no resolvable domain)", async () => {
      const scoring = new ScoringService(repositories());
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
