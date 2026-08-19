import { env } from "cloudflare:workers";
import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../../index";
import { PerformanceService } from "../../services/performance";
import { PlayerService } from "../../services/player";
import { TeamService } from "../../services/team";
import { LineupService } from "../../services/lineup";
import { GLOBAL_LEAGUE_ID } from "../../services/league";
import { unwrap } from "../../repositories/result";
import { repositories } from "../support/target";

const SCORE_DATE = "2026-07-12";
const AUTH = { Authorization: "Bearer test-scoring-secret" };

describe("/internal routes", () => {
  let playerId: string;
  let teamId: string;

  beforeEach(async () => {
    playerId = unwrap(
      await new PlayerService(repositories()).createPlayer(
        "internalplayer",
        "internal@example.com",
        "acc-internal-1",
      ),
      "player",
    ).id;
    // The Global League's domain is "en", which fixes the language scale.
    teamId = unwrap(
      await new TeamService(repositories()).createTeam(
        playerId,
        GLOBAL_LEAGUE_ID,
        "Internal FC",
      ),
      "team",
    ).id;
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
    const contract = unwrap(
      await repositories().contracts.create({
        teamId,
        articleId: "Active_Article",
        purchaseDate: Temporal.PlainDate.from("2026-07-01"),
        expireDate: Temporal.PlainDate.from("2026-07-15"),
        purchasePrice: 10,
      }),
      "contract",
    );
    unwrap(
      await new LineupService({
        ...repositories(),
        teamService: new TeamService(repositories()),
      }).saveLineup(playerId, GLOBAL_LEAGUE_ID, {
        formation: {
          date: SCORE_DATE,
          schema: "4-3-3",
          formation: { ST: { id: contract.id } as never },
        },
        bench: [],
      }),
      "lineup",
    );

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
    expect(inputs.find((i) => i.teamId === teamId)?.articles).toEqual([
      "Active_Article",
    ]);

    // Engine posts raw signals; the backend scores them (domain "en" -> L=1.0):
    // basePoints(64000)=5.0 + "good" synergy 0.5 = 5.5.
    const postRes = await app.request(
      "/internal/performances",
      {
        method: "POST",
        headers: { ...AUTH, "Content-Type": "application/json" },
        body: JSON.stringify({
          date: SCORE_DATE,
          results: [
            {
              teamId: teamId,
              articleViews: [64_000],
              chemistryLevels: ["good"],
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

    const performance = new PerformanceService(repositories());
    const rows = await performance.getRecentForTeam(teamId, 5);
    expect(rows.ok).toBe(true);
    if (rows.ok) expect(rows.value[0].points).toBeCloseTo(5.5);
  });
});
